import { Resend } from "resend";

export async function sendInviteEmail(params: {
  toEmail: string;
  toName?: string;
  invitedBy: string;
  hasPassword?: boolean;
  orgName?: string;
  appUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const from = process.env.EMAIL_FROM ?? "Data Room <onboarding@resend.dev>";
  const appUrl = params.appUrl ?? process.env.NEXTAUTH_URL ?? "https://dataroom.pltv.io";
  const orgName = params.orgName ?? "Data Room";
  const resend = new Resend(process.env.RESEND_API_KEY);
  const greeting = params.toName ? `Hi ${params.toName.split(" ")[0]},` : "Hi,";

  const loginInstructions = params.hasPassword
    ? `Sign in with your email address (<strong>${params.toEmail}</strong>) and the password provided by <strong>${params.invitedBy}</strong>.`
    : `Sign in with your Google account (<strong>${params.toEmail}</strong>) to get started.`;

  const loginNote = params.hasPassword
    ? `Use your email and password to sign in. Contact ${params.invitedBy} if you need to reset your password.`
    : `Access is restricted to your Google account (${params.toEmail}).`;

  const { error } = await resend.emails.send({
    from,
    to: params.toEmail,
    subject: `You've been invited to the ${orgName} Data Room`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111;">
        <div style="margin-bottom:24px;">
          <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;">${orgName} Data Room</h1>
        </div>
        <p style="margin:0 0 16px;line-height:1.6;">${greeting}</p>
        <p style="margin:0 0 24px;line-height:1.6;">
          You've been invited to access the ${orgName} Data Room by <strong>${params.invitedBy}</strong>.
          ${loginInstructions}
        </p>
        <a href="${appUrl}"
           style="display:inline-block;background:#2563eb;color:white;font-weight:600;font-size:15px;
                  text-decoration:none;padding:12px 28px;border-radius:8px;">
          Access Data Room →
        </a>
        <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
          All document views are logged. ${loginNote}
        </p>
      </div>
    `,
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
