import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrgFromHeaders } from "@/lib/org";
import { getAdminDriveAccessToken, listFolder, MIME_FOLDER } from "@/lib/drive";
import type { DriveFile } from "@/lib/drive";
import { NextResponse } from "next/server";

interface DocNode {
  name: string;
  path: string;
  type: "file" | "folder";
  driveId?: string;
  mimeType?: string;
  children?: DocNode[];
}

async function buildTree(folderId: string, folderPath: string, accessToken: string): Promise<DocNode[]> {
  const items = await listFolder(folderId, accessToken);
  const nodes: DocNode[] = [];

  for (const item of items) {
    const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    if (item.mimeType === MIME_FOLDER) {
      const children = await buildTree(item.id, itemPath, accessToken);
      nodes.push({ name: item.name, path: itemPath, type: "folder", driveId: item.id, children });
    } else {
      nodes.push({ name: item.name, path: itemPath, type: "file", driveId: item.id, mimeType: item.mimeType });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOrgFromHeaders();
  if (!org) return NextResponse.json([]);

  if (!org.drive_folder_id) return NextResponse.json([]);

  const accessToken = await getAdminDriveAccessToken(org.id);
  if (!accessToken) return NextResponse.json([]);

  try {
    const tree = await buildTree(org.drive_folder_id, "", accessToken);
    return NextResponse.json(tree);
  } catch {
    return NextResponse.json([]);
  }
}
