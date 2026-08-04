// api/send-message.ts
//
// Vercel Edge Function. Holds the Quo and SendGrid API keys server-side
// (same non-negotiable rule as the Gemini key -- never in client-side
// code) and sends a CRM Action draft AS the specific team member who's
// logged in and sending it, not a shared/generic identity.
//
// This function ONLY sends. It does not write anything to ClickUp --
// logging stays exactly as it already works via logActionSent() in the
// CRM itself, which the frontend calls automatically after a confirmed
// successful send here.
//
// Deploy: lives in the same /api folder as personalize-message.ts, same
// repo, same Vercel project -- auto-deploys on push, nothing extra to
// configure in Vercel beyond the two new Environment Variables below.
//
// Env vars needed (Vercel Project Settings -> Environment Variables):
//   QUO_API_KEY       -- from Quo Settings -> API
//   SENDGRID_API_KEY  -- from SendGrid Settings -> API Keys

export const config = { runtime: 'edge' };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const truncate = (s: unknown, max = 2000) => (typeof s === 'string' ? s.slice(0, max) : '');

// Very loose E.164-ish check -- good enough to fail fast on an obviously
// empty/malformed number before spending a Quo credit on a call that will
// just reject it anyway. Not trying to be a full phone validator here.
function looksLikePhone(s: string) {
  return /^\+?[1-9]\d{7,14}$/.test(s.replace(/[\s()-]/g, ''));
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Only POST is supported.' }, 405);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400);
    }

    const channel = truncate(body.channel, 10); // 'sms' | 'email'
    const message = truncate(body.message, 3000);
    if (!message) {
      return jsonResponse({ error: 'message is required.' }, 400);
    }

    // ───────────────────────── SMS via Quo ─────────────────────────
    if (channel === 'sms') {
      const quoKey = process.env.QUO_API_KEY;
      if (!quoKey) {
        return jsonResponse({ error: 'QUO_API_KEY is not set on this Vercel project.' }, 500);
      }

      const recipientPhone = truncate(body.recipientPhone, 30);
      const senderQuoFrom = truncate(body.senderQuoFrom, 30); // the sending team member's own Quo number, e.g. "+15551234567"
      if (!recipientPhone || !looksLikePhone(recipientPhone)) {
        return jsonResponse({ error: 'This entry has no valid phone number on file to send an SMS to.' }, 400);
      }
      if (!senderQuoFrom || !looksLikePhone(senderQuoFrom)) {
        return jsonResponse({ error: 'Your Quo number could not be found (check the Team Directory sheet, column S) -- cannot send as you specifically.' }, 400);
      }

      const quoRes = await fetch('https://api.quo.com/v1/messages', {
        method: 'POST',
        headers: {
          // Quo's docs show the raw key as the Authorization header value,
          // no "Bearer " prefix.
          'Authorization': quoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          from: senderQuoFrom,
          to: [recipientPhone],
        }),
      });

      const quoText = await quoRes.text();
      let quoJson: unknown;
      try { quoJson = JSON.parse(quoText); } catch { quoJson = quoText; }

      // Quo returns 202 Accepted on a successfully queued send.
      if (quoRes.status !== 202) {
        return jsonResponse({ error: `Quo API error (${quoRes.status})`, detail: quoJson }, 502);
      }

      return jsonResponse({ sent: true, channel: 'sms', detail: quoJson }, 200);
    }

    // ─────────────────────── Email via SendGrid ───────────────────────
    if (channel === 'email') {
      const sgKey = process.env.SENDGRID_API_KEY;
      if (!sgKey) {
        return jsonResponse({ error: 'SENDGRID_API_KEY is not set on this Vercel project.' }, 500);
      }

      const recipientEmail = truncate(body.recipientEmail, 200);
      const senderEmail = truncate(body.senderEmail, 200); // must be a Single Sender Verified address (or covered by domain auth)
      const senderName = truncate(body.senderName, 100) || 'MKC';
      const subject = truncate(body.subject, 200) || 'A quick note';

      if (!recipientEmail || !recipientEmail.includes('@')) {
        return jsonResponse({ error: 'This entry has no valid email address on file to send to.' }, 400);
      }
      if (!senderEmail || !senderEmail.includes('@')) {
        return jsonResponse({ error: 'Your SendGrid sender email could not be found (check the Team Directory sheet, column K) -- cannot send as you specifically.' }, 400);
      }

      const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sgKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: recipientEmail }] }],
          from: { email: senderEmail, name: senderName },
          subject,
          content: [{ type: 'text/plain', value: message }],
        }),
      });

      // SendGrid returns 202 with an EMPTY body on success -- do not try
      // to res.json() that, it'll throw. On failure it returns a JSON
      // error body, most commonly a 403 here specifically because the
      // sender address isn't verified yet (Single Sender Verification) --
      // surface that distinctly since it's the most likely real-world
      // failure as new team members are added.
      if (sgRes.status === 202) {
        return jsonResponse({ sent: true, channel: 'email' }, 200);
      }

      const sgText = await sgRes.text();
      let sgJson: unknown;
      try { sgJson = JSON.parse(sgText); } catch { sgJson = sgText; }

      if (sgRes.status === 403) {
        return jsonResponse({
          error: `SendGrid rejected this send (403) -- most likely "${senderEmail}" hasn't completed Single Sender Verification yet. Check SendGrid -> Sender Authentication.`,
          detail: sgJson,
        }, 502);
      }

      return jsonResponse({ error: `SendGrid API error (${sgRes.status})`, detail: sgJson }, 502);
    }

    return jsonResponse({ error: 'channel must be "sms" or "email".' }, 400);

  } catch (e) {
    return jsonResponse({ error: 'Unexpected server error.', detail: String(e) }, 500);
  }
}
