/**
 * Google Drive API client.
 * Uses the admin's OAuth access token (stored in NextAuth JWT) to access Drive.
 * The access token is obtained via the drive.readonly scope added to the Google provider.
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";

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
