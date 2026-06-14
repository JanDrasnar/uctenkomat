// Postgres úložiště (produkce). Aktivuje se, když je nastaveno DATABASE_URL.
// Schéma se vytváří idempotentně při startu (CREATE TABLE IF NOT EXISTS) —
// stejná konvence jako start-railway.js u propadmin, žádné prisma migrate.

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
});

function rowToDoc(r) {
  return {
    id: r.id,
    imageUrl: r.image_url,
    imagePath: r.image_path,
    period: r.period,
    reviewed: r.reviewed,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    data: r.data,
  };
}

export async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id          TEXT PRIMARY KEY,
      period      TEXT NOT NULL,
      reviewed    BOOLEAN NOT NULL DEFAULT false,
      image_url   TEXT,
      image_path  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      data        JSONB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_documents_period ON documents(period);
    CREATE TABLE IF NOT EXISTS sent_periods (
      period   TEXT PRIMARY KEY,
      sent_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function addDocument(doc) {
  await pool.query(
    `INSERT INTO documents (id, period, reviewed, image_url, image_path, created_at, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [doc.id, doc.period, doc.reviewed, doc.imageUrl, doc.imagePath, doc.createdAt, doc.data],
  );
  return doc;
}

export async function updateDocument(id, patch) {
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
  if (!rows.length) return null;
  const cur = rowToDoc(rows[0]);
  const next = { ...cur, ...patch };
  await pool.query(
    `UPDATE documents SET period=$2, reviewed=$3, data=$4 WHERE id=$1`,
    [id, next.period, next.reviewed, next.data],
  );
  return next;
}

export async function getDocument(id) {
  const { rows } = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
  return rows.length ? rowToDoc(rows[0]) : null;
}

export async function listByPeriod(period) {
  const { rows } = await pool.query(
    'SELECT * FROM documents WHERE period = $1 ORDER BY created_at ASC',
    [period],
  );
  return rows.map(rowToDoc);
}

export async function listPeriods() {
  const { rows } = await pool.query(`
    SELECT d.period,
           COUNT(*)::int AS count,
           COALESCE(SUM((d.data->>'castka_celkem')::numeric), 0) AS total,
           (sp.period IS NOT NULL) AS sent
    FROM documents d
    LEFT JOIN sent_periods sp ON sp.period = d.period
    GROUP BY d.period, sp.period
    ORDER BY d.period DESC
  `);
  return rows.map((r) => ({
    period: r.period,
    count: r.count,
    total: Number(r.total),
    sent: r.sent,
  }));
}

export async function markPeriodSent(period) {
  await pool.query(
    'INSERT INTO sent_periods (period) VALUES ($1) ON CONFLICT (period) DO NOTHING',
    [period],
  );
}
