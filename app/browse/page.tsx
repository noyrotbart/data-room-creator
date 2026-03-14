import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { DocTree } from "@/components/DocTree";
import { getOrgFromHeaders } from "@/lib/org";
import { getAdminDriveAccessToken, listFolder, MIME_FOLDER } from "@/lib/drive";

interface DocNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: DocNode[];
}

async function buildDriveTree(folderId: string, folderPath: string, accessToken: string): Promise<DocNode[]> {
  const items = await listFolder(folderId, accessToken);
  const nodes: DocNode[] = [];
  for (const item of items) {
    const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    if (item.mimeType === MIME_FOLDER) {
      const children = await buildDriveTree(item.id, itemPath, accessToken);
      nodes.push({ name: item.name, path: itemPath, type: "folder", children });
    } else {
      nodes.push({ name: item.name, path: itemPath, type: "file" });
    }
  }
  nodes.sort((a, b) => { if (a.type !== b.type) return a.type === "folder" ? -1 : 1; return a.name.localeCompare(b.name); });
  return nodes;
}

export default async function BrowsePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");

  const org = await getOrgFromHeaders();
  let tree: DocNode[] = [];

  if (org?.drive_folder_id) {
    try {
      const accessToken = await getAdminDriveAccessToken(org.id);
      if (accessToken) {
        tree = await buildDriveTree(org.drive_folder_id, "", accessToken);
      }
    } catch {}
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 bg-white border-r border-gray-200 overflow-y-auto p-4 hidden md:block">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">Documents</p>
          {tree.length > 0 ? <DocTree nodes={tree} /> : (
            <p className="text-sm text-gray-400 px-3">No documents yet. {org ? "Connect Google Drive in Settings." : ""}</p>
          )}
        </aside>
        <main className="flex-1 p-8">
          <div className="max-w-2xl mx-auto text-center pt-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Select a document</h2>
            <p className="text-gray-500 text-sm">Browse the folder tree on the left and click a file to view it.</p>
            <div className="mt-8 md:hidden">
              {tree.length > 0 && <DocTree nodes={tree} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
