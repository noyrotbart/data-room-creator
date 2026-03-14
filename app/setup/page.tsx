import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOrgFromHeaders } from "@/lib/org";
import { isOrgAdmin, getAdminToken } from "@/lib/db";
import SetupWizard from "./SetupWizard";

export default async function SetupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const org = await getOrgFromHeaders();
  if (!org) redirect("/");

  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) redirect("/browse");

  const hasToken = !!(await getAdminToken("drive_access_token", org.id));

  return (
    <SetupWizard
      orgId={org.id}
      orgSlug={org.slug}
      orgName={org.name}
      hasToken={hasToken}
      hasDriveFolder={!!org.drive_folder_id}
    />
  );
}
