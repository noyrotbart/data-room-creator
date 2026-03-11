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
  await db(`CREATE INDEX IF NOT EXISTS idx_views_file ON views(file_path)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_views_email ON views(user_email)`);
  await db(`CREATE INDEX IF NOT EXISTS idx_views_time ON views(viewed_at)`);
}

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
    [
      params.userEmail,
      params.userName ?? null,
      params.filePath,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ]
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
}

export async function getRecentViews(limit = 100): Promise<ViewRow[]> {
  const db = sql();
  const rows = await db(
    `SELECT * FROM views ORDER BY viewed_at DESC LIMIT $1`,
    [limit]
  );
  return rows as ViewRow[];
}

export async function getViewsByFile(): Promise<
  { file_path: string; count: number; unique_viewers: number }[]
> {
  const db = sql();
  const rows = await db(`
    SELECT file_path,
           COUNT(*)::int AS count,
           COUNT(DISTINCT user_email)::int AS unique_viewers
    FROM views
    GROUP BY file_path
    ORDER BY count DESC
  `);
  return rows as any[];
}

export async function getViewsByUser(): Promise<
  { user_email: string; user_name: string | null; count: number; last_seen: string }[]
> {
  const db = sql();
  const rows = await db(`
    SELECT user_email,
           user_name,
           COUNT(*)::int AS count,
           MAX(viewed_at) AS last_seen
    FROM views
    GROUP BY user_email, user_name
    ORDER BY last_seen DESC
  `);
  return rows as any[];
}
