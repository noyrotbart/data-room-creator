/**
 * Google Drive API client.
 * Drive access tokens are stored in the admin_tokens DB table via the
 * /api/admin/drive-connect OAuth flow — completely separate from regular sign-in.
 */

import { getAdminToken, setAdminToken } from "@/lib/db";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

/**
 * Returns a valid Drive access token for the admin, refreshing it if needed.
 * Returns null if no Drive connection has been established yet.
 */
export async function getAdminDriveAccessToken(): Promise<string | null> {
  const [accessToken, refreshToken, expiresStr] = await Promise.all([
    getAdminToken("drive_access_token"),
    getAdminToken("drive_refresh_token"),
    getAdminToken("drive_token_expires"),
  ]);

  if (!accessToken) return null;

  // Token still valid (with 60s buffer)
  const expires = expiresStr ? parseInt(expiresStr) : 0;
  if (expires && Date.now() < expires - 60_000) {
    return accessToken;
  }

  // Try to refresh
  if (!refreshToken) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    await setAdminToken("drive_access_token", data.access_token);
    await setAdminToken(
      "drive_token_expires",
      String(Date.now() + (data.expires_in as number) * 1000)
    );
    return data.access_token as string;
  } catch {
    return null;
  }
}

export const MIME_FOLDER = "application/vnd.google-apps.folder";
export const MIME_GDOC = "application/vnd.google-apps.document";
export const MIME_GSHEET = "application/vnd.google-apps.spreadsheet";
export const MIME_PDF = "application/pdf";
export const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MIME_CSV = "text/csv";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

/** List all (non-trashed) files directly inside a folder. */
export async function listFolder(
  folderId: string,
  accessToken: string
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${DRIVE_API}/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Drive API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return files;
}

/** Returns true for file types we can extract text from. */
export function isTextExtractable(mimeType: string): boolean {
  return [MIME_GDOC, MIME_GSHEET, MIME_PDF, MIME_DOCX, MIME_XLSX, MIME_CSV].includes(
    mimeType
  );
}

async function fetchText(url: string, accessToken: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return "";
  return res.text();
}

async function fetchBuffer(url: string, accessToken: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return Buffer.alloc(0);
  return Buffer.from(await res.arrayBuffer());
}

/** Extract plain text from a Drive file. */
export async function extractDriveText(
  file: DriveFile,
  accessToken: string
): Promise<string> {
  // Google Docs → export as plain text
  if (file.mimeType === MIME_GDOC) {
    return fetchText(
      `${DRIVE_API}/files/${file.id}/export?mimeType=text%2Fplain`,
      accessToken
    );
  }

  // Google Sheets → export as CSV (first sheet only, good enough for search)
  if (file.mimeType === MIME_GSHEET) {
    return fetchText(
      `${DRIVE_API}/files/${file.id}/export?mimeType=text%2Fcsv`,
      accessToken
    );
  }

  // All binary formats — download as buffer then parse
  const buf = await fetchBuffer(
    `${DRIVE_API}/files/${file.id}?alt=media`,
    accessToken
  );
  if (!buf.length) return "";

  if (file.mimeType === MIME_PDF) {
    try {
      const pdfParse =
        ((await import("pdf-parse")) as any).default ??
        (await import("pdf-parse"));
      const data = await pdfParse(buf);
      return data.text as string;
    } catch {
      return "";
    }
  }

  if (file.mimeType === MIME_DOCX) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value;
    } catch {
      return "";
    }
  }

  if (file.mimeType === MIME_XLSX) {
    try {
      const XLSXmod = await import("xlsx");
      const XLSX = (XLSXmod as any).default ?? XLSXmod;
      const wb = XLSX.read(buf, { type: "buffer" });
      const parts: string[] = [];
      let total = 0;
      const MAX_CHARS = 200_000;
      for (const name of wb.SheetNames as string[]) {
        const lower = name.toLowerCase();
        if (
          lower.startsWith("tmp_") ||
          lower.startsWith("temp_") ||
          lower.startsWith("sheet")
        )
          continue;
        const ws = wb.Sheets[name];
        const csv = XLSX.utils.sheet_to_csv(ws) as string;
        parts.push(`[Sheet: ${name}]\n${csv}`);
        total += csv.length;
        if (total >= MAX_CHARS) break;
      }
      return parts.join("\n\n");
    } catch {
      return "";
    }
  }

  if (file.mimeType === MIME_CSV) {
    return buf.toString("utf-8");
  }

  return "";
}
