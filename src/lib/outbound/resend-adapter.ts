import { registerSendAdapter } from "./send";

// Resend-backed send adapter for the guarded outbound layer.
// From-address lives on htxsigncrafters.com (the dedicated outreach domain) —
// NEVER the primary houstonsigncrafters.com mailbox. The guarded layer still
// requires ALLOW_EXTERNAL_SEND=true AND an approved, unused approval per send.

export function registerResendAdapterIfConfigured(): boolean {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.SEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) return false;
  registerSendAdapter(async (message) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `Rameel at Houston Sign Crafters <${fromEmail}>`,
        to: [message.to],
        subject: message.subject,
        text: message.body,
        reply_to: "sales@houstonsigncrafters.com",
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend send failed: HTTP ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string };
    return { providerId: data.id };
  });
  return true;
}
