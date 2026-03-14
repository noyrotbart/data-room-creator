import { neon } from "@neondatabase/serverless";

function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const db = neon(process.env.DATABASE_URL);
  return db;
}

export async function ensureTables() {
  const db = sql();

  await db(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#2563eb',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      drive_folder_id TEXT
    )
  `);

  await db(`
    CREATE TABLE IF NOT EXISTS views (
      id SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_name TEXT,
      file_path TEXT NOT NULL,
      viewed_at TIMESTAMPTZ DEFAULT NOW(),
      ip_address TEXT,
      user_agent TEXT
    )
  `);
  await db(`ALTER TABLE views ADD COLUMN IF NOT EXISTS duration_seconds INTEGER`);
  await db(`ALTER TABLE views ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_views_file ON views(file_path)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_views_email ON views(user_email)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_views_time ON views(viewed_at)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_views_org ON views(org_id)`);

  await db(`
    CREATE TABLE IF NOT EXISTS allowed_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT,
      granted_at TIMESTAMPTZ DEFAULT NOW(),
      granted_by TEXT NOT NULL,
      revoked_at TIMESTAMPTZ
    )
  `);
  await db(`ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await db(`ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
  await db(`ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS can_download BOOLEAN DEFAULT FALSE`);
  await db(`ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`);
  await db(`ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'viewer'`);
  await db(`CREATE UNIQUE INDEX IF NOT EXISTS idx_allowed_users_org_email ON allowed_users(org_id, email)`);

  await db(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id SERIAL PRIMARY KEY,
      file_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(file_path, chunk_index)
    )
  `);
  await db(`ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING gin(to_tsvector('english', chunk_text))`);
  await db(`CREATE INDEX IF NOT EXISTS idx_chunks_path ON document_chunks(file_path)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_chunks_org ON document_chunks(org_id)`);

  await db(`
    CREATE TABLE IF NOT EXISTS admin_tokens (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db(`ALTER TABLE admin_tokens ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`);
}

// ─── Organizations ────────────────────────────────────────────────────────────

export interface OrgRow {
  id: number;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  created_at: string;
  drive_folder_id: string | null;
}

export async function createOrganization(params: {
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}): Promise<OrgRow> {
  const db = sql();
  const rows = await db(
    `INSERT INTO organizations (slug, name, logo_url, primary_color) VALUES ($1, $2, $3, $4) RETURNING *`,
    [params.slug, params.name, params.logoUrl ?? null, params.primaryColor ?? "#2563eb"]
  );
  return rows[0] as OrgRow;
}

export async function getOrgBySlug(slug: string): Promise<OrgRow | null> {
  const db = sql();
  const rows = await db(`SELECT * FROM organizations WHERE slug = $1 LIMIT 1`, [slug]);
  return rows.length ? (rows[0] as OrgRow) : null;
}

export async function getOrgById(id: number): Promise<OrgRow | null> {
  const db = sql();
  const rows = await db(`SELECT * FROM organizations WHERE id = $1 LIMIT 1`, [id]);
  return rows.length ? (rows[0] as OrgRow) : null;
}

export async function updateOrgSettings(
  orgId: number,
  settings: { name?: string; logoUrl?: string; primaryColor?: string; driveFolderId?: string }
): Promise<void> {
  const db = sql();
  const updates: string[] = [];
  const values: any[] = [];
  let i = 1;
  if (settings.name !== undefined) { updates.push(`name = $${i++}`); values.push(settings.name); }
  if (settings.logoUrl !== undefined) { updates.push(`logo_url = $${i++}`); values.push(settings.logoUrl); }
  if (settings.primaryColor !== undefined) { updates.push(`primary_color = $${i++}`); values.push(settings.primaryColor); }
  if (settings.driveFolderId !== undefined) { updates.push(`drive_folder_id = $${i++}`); values.push(settings.driveFolderId); }
  if (!updates.length) return;
  values.push(orgId);
  await db(`UPDATE organizations SET ${updates.join(", ")} WHERE id = $${i}`, values);
}

export async function getAllOrgs(): Promise<OrgRow[]> {
  const db = sql();
  const rows = await db(`SELECT * FROM organizations ORDER BY created_at DESC`);
  return rows as OrgRow[];
}

// ─── Views ────────────────────────────────────────────────────────────────────

export async function logView(params: {
  userEmail: string; userName?: string; filePath: string; ipAddress?: string; userAgent?: string; orgId?: number;
}) {
  const db = sql();
  await db(
    `INSERT INTO views (user_email, user_name, file_path, ip_address, user_agent, org_id) VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.userEmail, params.userName ?? null, params.filePath, params.ipAddress ?? null, params.userAgent ?? null, params.orgId ?? null]
  );
}

export async function updateViewDuration(userEmail: string, filePath: string, durationSeconds: number) {
  const db = sql();
  await db(
    `UPDATE views SET duration_seconds = $1 WHERE id = (
       SELECT id FROM views WHERE user_email = $2 AND file_path = $3 AND viewed_at > NOW() - INTERVAL '2 hours'
       ORDER BY viewed_at DESC LIMIT 1)`,
    [durationSeconds, userEmail, filePath]
  );
}

export interface ViewRow {
  id: number; user_email: string; user_name: string | null; file_path: string;
  viewed_at: string; ip_address: string | null; user_agent: string | null;
  duration_seconds: number | null; org_id: number | null;
}

export async function getRecentViews(orgId: number, limit = 100): Promise<ViewRow[]> {
  const db = sql();
  return await db(`SELECT * FROM views WHERE org_id = $1 ORDER BY viewed_at DESC LIMIT $2`, [orgId, limit]) as ViewRow[];
}

export async function getViewsByFile(orgId: number) {
  const db = sql();
  return await db(`
    SELECT file_path, COUNT(*)::int AS count, COUNT(DISTINCT user_email)::int AS unique_viewers,
           ROUND(AVG(duration_seconds))::int AS avg_seconds
    FROM views WHERE org_id = $1 GROUP BY file_path ORDER BY count DESC`, [orgId]) as any[];
}

export async function getViewsByUser(orgId: number) {
  const db = sql();
  return await db(`
    SELECT user_email, user_name, COUNT(*)::int AS count, MAX(viewed_at) AS last_seen,
           SUM(duration_seconds)::int AS total_seconds
    FROM views WHERE org_id = $1 GROUP BY user_email, user_name ORDER BY last_seen DESC`, [orgId]) as any[];
}

// ─── Allowed users ────────────────────────────────────────────────────────────

export interface AllowedUserRow {
  id: number; email: string; name: string | null; granted_at: string; granted_by: string;
  revoked_at: string | null; password_hash: string | null; expires_at: string | null;
  can_download: boolean; org_id: number | null; role: string;
}

export async function isAllowedUser(email: string, orgId: number): Promise<boolean> {
  const db = sql();
  const rows = await db(
    `SELECT 1 FROM allowed_users WHERE email = $1 AND org_id = $2 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
    [email, orgId]
  );
  return rows.length > 0;
}

export async function isOrgAdmin(email: string, orgId: number): Promise<boolean> {
  const db = sql();
  const rows = await db(
    `SELECT 1 FROM allowed_users WHERE email = $1 AND org_id = $2 AND role = 'admin' AND revoked_at IS NULL LIMIT 1`,
    [email, orgId]
  );
  return rows.length > 0;
}

export async function grantAccess(params: {
  email: string; name?: string; grantedBy: string; durationDays?: number;
  passwordHash?: string | null; canDownload?: boolean; orgId: number; role?: string;
}): Promise<void> {
  const db = sql();
  const expiresAt = params.durationDays ? new Date(Date.now() + params.durationDays * 86_400_000).toISOString() : null;
  await db(
    `INSERT INTO allowed_users (email, name, granted_by, revoked_at, expires_at, password_hash, can_download, org_id, role)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8)
     ON CONFLICT (org_id, email) DO UPDATE
       SET name = EXCLUDED.name, granted_by = EXCLUDED.granted_by, granted_at = NOW(), revoked_at = NULL,
           expires_at = EXCLUDED.expires_at, password_hash = COALESCE(EXCLUDED.password_hash, allowed_users.password_hash),
           can_download = EXCLUDED.can_download, role = EXCLUDED.role`,
    [params.email, params.name ?? null, params.grantedBy, expiresAt, params.passwordHash ?? null, params.canDownload ?? false, params.orgId, params.role ?? "viewer"]
  );
}

export async function revokeAccess(email: string, orgId: number): Promise<void> {
  const db = sql();
  await db(`UPDATE allowed_users SET revoked_at = NOW() WHERE email = $1 AND org_id = $2`, [email, orgId]);
}

export async function getAllowedUsers(orgId: number): Promise<AllowedUserRow[]> {
  const db = sql();
  return await db(`SELECT * FROM allowed_users WHERE org_id = $1 ORDER BY granted_at DESC`, [orgId]) as AllowedUserRow[];
}

export interface AllowedUserWithActivity extends AllowedUserRow {
  view_count: number; total_seconds: number | null; last_seen: string | null;
}

export async function setUserPassword(email: string, orgId: number, passwordHash: string | null): Promise<void> {
  const db = sql();
  await db(`UPDATE allowed_users SET password_hash = $1 WHERE email = $2 AND org_id = $3`, [passwordHash, email, orgId]);
}

export async function getUserPasswordHash(email: string, orgId: number): Promise<string | null> {
  const db = sql();
  const rows = await db(`SELECT password_hash FROM allowed_users WHERE email = $1 AND org_id = $2 AND revoked_at IS NULL LIMIT 1`, [email, orgId]);
  if (!rows.length) return null;
  return (rows[0] as any).password_hash ?? null;
}

export async function getUserPasswordHashAnyOrg(email: string): Promise<{ password_hash: string | null; org_id: number } | null> {
  const db = sql();
  const rows = await db(
    `SELECT password_hash, org_id FROM allowed_users WHERE email = $1 AND revoked_at IS NULL AND password_hash IS NOT NULL LIMIT 1`,
    [email]
  );
  if (!rows.length) return null;
  return rows[0] as any;
}

export async function setDownloadPermission(email: string, orgId: number, canDownload: boolean): Promise<void> {
  const db = sql();
  await db(`UPDATE allowed_users SET can_download = $1 WHERE email = $2 AND org_id = $3`, [canDownload, email, orgId]);
}

export async function getAllowedUsersWithActivity(orgId: number): Promise<AllowedUserWithActivity[]> {
  const db = sql();
  return await db(`
    SELECT au.*, COUNT(v.id)::int AS view_count, SUM(v.duration_seconds)::int AS total_seconds, MAX(v.viewed_at) AS last_seen
    FROM allowed_users au LEFT JOIN views v ON v.user_email = au.email AND v.org_id = au.org_id
    WHERE au.org_id = $1
    GROUP BY au.id, au.email, au.name, au.granted_at, au.granted_by, au.revoked_at, au.password_hash, au.expires_at, au.can_download, au.org_id, au.role
    ORDER BY au.granted_at DESC`, [orgId]) as AllowedUserWithActivity[];
}

export async function getAllowedUserByEmail(email: string, orgId: number): Promise<AllowedUserRow | null> {
  const db = sql();
  const rows = await db(`SELECT * FROM allowed_users WHERE email = $1 AND org_id = $2 LIMIT 1`, [email, orgId]);
  return rows.length ? (rows[0] as AllowedUserRow) : null;
}

export async function getUserOrgs(email: string): Promise<{ org_id: number; org_slug: string; org_name: string; role: string }[]> {
  const db = sql();
  return await db(
    `SELECT au.org_id, o.slug AS org_slug, o.name AS org_name, au.role
     FROM allowed_users au JOIN organizations o ON o.id = au.org_id
     WHERE au.email = $1 AND au.revoked_at IS NULL AND (au.expires_at IS NULL OR au.expires_at > NOW())
     ORDER BY o.name`, [email]) as any[];
}

export interface UserDocumentActivity {
  file_path: string; view_count: number; total_seconds: number | null; last_viewed: string; first_viewed: string;
}

export async function getViewsForUser(email: string, orgId: number) {
  const db = sql();
  const byDoc = await db(
    `SELECT file_path, COUNT(*)::int AS view_count, SUM(duration_seconds)::int AS total_seconds,
            MAX(viewed_at) AS last_viewed, MIN(viewed_at) AS first_viewed
     FROM views WHERE user_email = $1 AND org_id = $2 GROUP BY file_path ORDER BY last_viewed DESC`, [email, orgId]);
  const recent = await db(`SELECT * FROM views WHERE user_email = $1 AND org_id = $2 ORDER BY viewed_at DESC LIMIT 100`, [email, orgId]);
  return { byDocument: byDoc as UserDocumentActivity[], recent: recent as ViewRow[] };
}

// ─── Admin tokens (org-scoped) ────────────────────────────────────────────────

export async function setAdminToken(key: string, value: string, orgId: number): Promise<void> {
  const db = sql();
  const compositeKey = `${orgId}:${key}`;
  await db(
    `INSERT INTO admin_tokens (key, value, updated_at, org_id) VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), org_id = EXCLUDED.org_id`,
    [compositeKey, value, orgId]
  );
}

export async function getAdminToken(key: string, orgId: number): Promise<string | null> {
  const db = sql();
  const compositeKey = `${orgId}:${key}`;
  const rows = await db(`SELECT value FROM admin_tokens WHERE key = $1`, [compositeKey]);
  return rows.length ? (rows[0] as any).value : null;
}

// ─── Document chunks (org-scoped) ─────────────────────────────────────────────

export interface ChunkRow {
  file_path: string; chunk_index: number; chunk_text: string; rank?: number;
}

export async function upsertChunks(chunks: { filePath: string; chunkIndex: number; chunkText: string }[], orgId: number): Promise<void> {
  if (!chunks.length) return;
  const db = sql();
  for (const c of chunks) {
    await db(
      `INSERT INTO document_chunks (file_path, chunk_index, chunk_text, org_id) VALUES ($1, $2, $3, $4)
       ON CONFLICT (file_path, chunk_index) DO UPDATE SET chunk_text = EXCLUDED.chunk_text, org_id = EXCLUDED.org_id`,
      [c.filePath, c.chunkIndex, c.chunkText, orgId]
    );
  }
}

export async function searchChunks(query: string, orgId: number, limit = 8): Promise<ChunkRow[]> {
  const db = sql();
  return await db(
    `SELECT file_path, chunk_index, chunk_text,
            ts_rank(to_tsvector('english', chunk_text), plainto_tsquery('english', $1)) AS rank
     FROM document_chunks WHERE org_id = $3 AND to_tsvector('english', chunk_text) @@ plainto_tsquery('english', $1)
     ORDER BY rank DESC LIMIT $2`, [query, limit, orgId]) as ChunkRow[];
}
