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
  await db(`CREATE INDEX IF NOT EXISTS idx_views_file ON views(file_path)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_views_email ON views(user_email)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_views_time ON views(viewed_at)`);

  await db(`
    CREATE TABLE IF NOT EXISTS allowed_users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      granted_at TIMESTAMPTZ DEFAULT NOW(),
      granted_by TEXT NOT NULL,
      revoked_at TIMESTAMPTZ
    )
  `);
  await db(`ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS password_hash TEXT`);
  await db(`ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`);
  await db(`ALTER TABLE allowed_users ADD COLUMN IF NOT EXISTS can_download BOOLEAN DEFAULT FALSE`);

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
  await db(`
    CREATE INDEX IF NOT EXISTS idx_chunks_fts
      ON document_chunks USING gin(to_tsvector('english', chunk_text))
  `);
  await db(`CREATE INDEX IF NOT EXISTS idx_chunks_path ON document_chunks(file_path)`);

  await db(`
    CREATE TABLE IF NOT EXISTS admin_tokens (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// ─── Views ────────────────────────────────────────────────────────────────────

export async function logView(params: {
  userEmail: string;
  userName?: string;
  filePath: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const db = sql();
  await db(
    `INSERT INTO views (user_email, user_name, file_path, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [params.userEmail, params.userName ?? null, params.filePath, params.ipAddress ?? null, params.userAgent ?? null]
  );
}

export async function updateViewDuration(userEmail: string, filePath: string, durationSeconds: number) {
  const db = sql();
  await db(
    `UPDATE views
     SET duration_seconds = $1
     WHERE id = (
       SELECT id FROM views
       WHERE user_email = $2 AND file_path = $3 AND viewed_at > NOW() - INTERVAL '2 hours'
       ORDER BY viewed_at DESC LIMIT 1
     )`,
    [durationSeconds, userEmail, filePath]
  );
}

export interface ViewRow {
  id: number;
  user_email: string;
  user_name: string | null;
  file_path: string;
  viewed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  duration_seconds: number | null;
}

export async function getRecentViews(limit = 100): Promise<ViewRow[]> {
  const db = sql();
  const rows = await db(`SELECT * FROM views ORDER BY viewed_at DESC LIMIT $1`, [limit]);
  return rows as ViewRow[];
}

export async function getViewsByFile(): Promise<
  { file_path: string; count: number; unique_viewers: number; avg_seconds: number | null }[]
> {
  const db = sql();
  const rows = await db(`
    SELECT file_path,
           COUNT(*)::int AS count,
           COUNT(DISTINCT user_email)::int AS unique_viewers,
           ROUND(AVG(duration_seconds))::int AS avg_seconds
    FROM views
    GROUP BY file_path
    ORDER BY count DESC
  `);
  return rows as any[];
}

export async function getViewsByUser(): Promise<
  { user_email: string; user_name: string | null; count: number; last_seen: string; total_seconds: number | null }[]
> {
  const db = sql();
  const rows = await db(`
    SELECT user_email, user_name,
           COUNT(*)::int AS count,
           MAX(viewed_at) AS last_seen,
           SUM(duration_seconds)::int AS total_seconds
    FROM views
    GROUP BY user_email, user_name
    ORDER BY last_seen DESC
  `);
  return rows as any[];
}

// ─── Allowed users ────────────────────────────────────────────────────────────

export interface AllowedUserRow {
  id: number;
  email: string;
  name: string | null;
  granted_at: string;
  granted_by: string;
  revoked_at: string | null;
  password_hash: string | null;
  expires_at: string | null;
  can_download: boolean;
}

export async function isAllowedUser(email: string): Promise<boolean> {
  const db = sql();
  const rows = await db(
    `SELECT 1 FROM allowed_users
     WHERE email = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [email]
  );
  return rows.length > 0;
}

export async function grantAccess(params: {
  email: string;
  name?: string;
  grantedBy: string;
  durationDays?: number;
  passwordHash?: string | null;
  canDownload?: boolean;
}): Promise<void> {
  const db = sql();
  const expiresAt = params.durationDays
    ? new Date(Date.now() + params.durationDays * 86_400_000).toISOString()
    : null;
  await db(
    `INSERT INTO allowed_users (email, name, granted_by, revoked_at, expires_at, password_hash, can_download)
     VALUES ($1, $2, $3, NULL, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE
       SET name          = EXCLUDED.name,
           granted_by    = EXCLUDED.granted_by,
           granted_at    = NOW(),
           revoked_at    = NULL,
           expires_at    = EXCLUDED.expires_at,
           password_hash = COALESCE(EXCLUDED.password_hash, allowed_users.password_hash),
           can_download  = EXCLUDED.can_download`,
    [params.email, params.name ?? null, params.grantedBy, expiresAt, params.passwordHash ?? null, params.canDownload ?? false]
  );
}

export async function revokeAccess(email: string): Promise<void> {
  const db = sql();
  await db(`UPDATE allowed_users SET revoked_at = NOW() WHERE email = $1`, [email]);
}

export async function getAllowedUsers(): Promise<AllowedUserRow[]> {
  const db = sql();
  const rows = await db(`SELECT * FROM allowed_users ORDER BY granted_at DESC`);
  return rows as AllowedUserRow[];
}

export interface AllowedUserWithActivity extends AllowedUserRow {
  view_count: number;
  total_seconds: number | null;
  last_seen: string | null;
}

export async function setUserPassword(email: string, passwordHash: string | null): Promise<void> {
  const db = sql();
  await db(`UPDATE allowed_users SET password_hash = $1 WHERE email = $2`, [passwordHash, email]);
}

export async function getUserPasswordHash(email: string): Promise<string | null> {
  const db = sql();
  const rows = await db(
    `SELECT password_hash FROM allowed_users WHERE email = $1 AND revoked_at IS NULL LIMIT 1`,
    [email]
  );
  if (!rows.length) return null;
  return (rows[0] as any).password_hash ?? null;
}

export async function setDownloadPermission(email: string, canDownload: boolean): Promise<void> {
  const db = sql();
  await db(`UPDATE allowed_users SET can_download = $1 WHERE email = $2`, [canDownload, email]);
}

export async function getAllowedUsersWithActivity(): Promise<AllowedUserWithActivity[]> {
  const db = sql();
  const rows = await db(`
    SELECT
      au.*,
      COUNT(v.id)::int             AS view_count,
      SUM(v.duration_seconds)::int AS total_seconds,
      MAX(v.viewed_at)             AS last_seen
    FROM allowed_users au
    LEFT JOIN views v ON v.user_email = au.email
    GROUP BY au.id, au.email, au.name, au.granted_at, au.granted_by, au.revoked_at,
             au.password_hash, au.expires_at, au.can_download
    ORDER BY au.granted_at DESC
  `);
  return rows as AllowedUserWithActivity[];
}

export async function getAllowedUserByEmail(email: string): Promise<AllowedUserRow | null> {
  const db = sql();
  const rows = await db(`SELECT * FROM allowed_users WHERE email = $1 LIMIT 1`, [email]);
  return rows.length ? (rows[0] as AllowedUserRow) : null;
}

export interface UserDocumentActivity {
  file_path: string;
  view_count: number;
  total_seconds: number | null;
  last_viewed: string;
  first_viewed: string;
}

export async function getViewsForUser(email: string): Promise<{
  byDocument: UserDocumentActivity[];
  recent: ViewRow[];
}> {
  const db = sql();
  const byDoc = await db(
    `SELECT file_path,
            COUNT(*)::int              AS view_count,
            SUM(duration_seconds)::int AS total_seconds,
            MAX(viewed_at)             AS last_viewed,
            MIN(viewed_at)             AS first_viewed
     FROM views WHERE user_email = $1
     GROUP BY file_path ORDER BY last_viewed DESC`,
    [email]
  );
  const recent = await db(
    `SELECT * FROM views WHERE user_email = $1 ORDER BY viewed_at DESC LIMIT 100`,
    [email]
  );
  return { byDocument: byDoc as UserDocumentActivity[], recent: recent as ViewRow[] };
}

// ─── Admin tokens ─────────────────────────────────────────────────────────────

export async function setAdminToken(key: string, value: string): Promise<void> {
  const db = sql();
  await db(
    `INSERT INTO admin_tokens (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

export async function getAdminToken(key: string): Promise<string | null> {
  const db = sql();
  const rows = await db(`SELECT value FROM admin_tokens WHERE key = $1`, [key]);
  return rows.length ? (rows[0] as any).value : null;
}

// ─── Document chunks ──────────────────────────────────────────────────────────

export interface ChunkRow {
  file_path: string;
  chunk_index: number;
  chunk_text: string;
  rank?: number;
}

export async function upsertChunks(chunks: { filePath: string; chunkIndex: number; chunkText: string }[]): Promise<void> {
  if (!chunks.length) return;
  const db = sql();
  for (const c of chunks) {
    await db(
      `INSERT INTO document_chunks (file_path, chunk_index, chunk_text) VALUES ($1, $2, $3)
       ON CONFLICT (file_path, chunk_index) DO UPDATE SET chunk_text = EXCLUDED.chunk_text`,
      [c.filePath, c.chunkIndex, c.chunkText]
    );
  }
}

export async function searchChunks(query: string, limit = 8): Promise<ChunkRow[]> {
  const db = sql();
  const rows = await db(
    `SELECT file_path, chunk_index, chunk_text,
            ts_rank(to_tsvector('english', chunk_text), plainto_tsquery('english', $1)) AS rank
     FROM document_chunks
     WHERE to_tsvector('english', chunk_text) @@ plainto_tsquery('english', $1)
     ORDER BY rank DESC LIMIT $2`,
    [query, limit]
  );
  return rows as ChunkRow[];
}
