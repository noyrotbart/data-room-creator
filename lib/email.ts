import { Resend } from "resend";

const APP_URL = "https://data-room-bay.vercel.app";
const FROM = process.env.EMAIL_FROM ?? "Data Room <onboarding@resend.dev>";

export async function sendInviteEmail(params: {
  toEmail: string;
  toName?: string;
  invitedBy: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const greeting = params.toName ? `Hi ${params.toName.split(" ")[0]},` : "Hi,";

  const { error } = await resend.emails.send({
    from: FROM,
    to: params.toEmail,
    subject: "You've been invited to the Churney Data Room",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111;">
        <div style="margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;">Churney Data Room</h1>
        </div>
        <p style="margin:0 0 16px;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 24px;line-height:1.6;">
          You've been invited to access the Churney Data Room by <strong>${params.invitedBy}</strong>.
          Sign in with your Google account to get started.
        </p>
        <a href="${APP_URL}"
           style="display:inline-block;background:#2563eb;color:white;font-weight:600;font-size:15px;
                  text-decoration:none;padding:12px 28px;border-radius:8px;">
          Access Data Room →
        </a>
        <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
          All document views are logged. Access is restricted to your Google account (${params.toEmail}).
        </p>
      </div>
    `,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
