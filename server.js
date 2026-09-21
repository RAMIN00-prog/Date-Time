import express from "express";
import crypto from "crypto";
import pg from "pg";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (IS_PRODUCTION && !ADMIN_TOKEN) throw new Error("ADMIN_TOKEN is required in production");
if (IS_PRODUCTION && !DATABASE_URL) throw new Error("DATABASE_URL is required in production");

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json({ limit: "20kb" }));

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "יותר מדי בקשות. נסה שוב בעוד כמה דקות." }
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות." }
});
app.use("/api", publicLimiter);

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: IS_PRODUCTION ? { rejectUnauthorized: false } : false, max: 5 })
  : null;

function clean(value, max) {
  return String(value ?? "").trim().slice(0, max);
}
function makeId() {
  return crypto.randomBytes(12).toString("base64url");
}
function sameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (!origin) return next();
  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const proto = req.get("x-forwarded-proto") || req.protocol;
  const expected = `${proto}://${host}`;
  if (origin !== expected) return res.status(403).json({ error: "Origin not allowed" });
  next();
}
function requireAdmin(req, res, next) {
  const token = req.get("x-admin-token");
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(401).json({ error: "Unauthorized" });
  next();
}
function parseFutureDate(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return false;
  const d = new Date(`${date}T${time}:00`);
  return Number.isFinite(d.getTime()) && d.getTime() > Date.now();
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'sent',
      accepted BOOLEAN,
      date_type TEXT,
      date_value DATE,
      time_value TIME,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS invites_created_at_idx ON invites (created_at DESC);
  `);
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, service: "Date Time", version: "3.0" });
  } catch {
    res.status(503).json({ ok: false, service: "Date Time" });
  }
});

app.post("/api/invites", writeLimiter, sameOrigin, async (req, res, next) => {
  try {
    const name = clean(req.body?.name, 80);
    const message = clean(req.body?.message, 500);
    if (!name) return res.status(400).json({ error: "שם הוא שדה חובה" });
    const id = makeId();
    await pool.query(
      `INSERT INTO invites (id, name, message) VALUES ($1, $2, $3)`,
      [id, name, message]
    );
    res.status(201).json({ invite: { id, name, message, status: "sent" }, url: `/invite.html?id=${encodeURIComponent(id)}` });
  } catch (err) { next(err); }
});

app.get("/api/invites/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, message, status FROM invites WHERE id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Invitation not found" });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

app.post("/api/invites/:id/response", writeLimiter, sameOrigin, async (req, res, next) => {
  try {
    const id = clean(req.params.id, 64);
    const dateType = clean(req.body?.dateType, 60);
    const date = clean(req.body?.date, 10);
    const time = clean(req.body?.time, 5);
    const note = clean(req.body?.note, 500);
    const allowedTypes = new Set(["ארוחת ערב", "קפה ושיחה", "הליכה בשקיעה", "הפתעה"]);

    if (req.body?.accepted !== true) return res.status(400).json({ error: "Response not supported" });
    if (!allowedTypes.has(dateType)) return res.status(400).json({ error: "סוג דייט לא תקין" });
    if (!parseFutureDate(date, time)) return res.status(400).json({ error: "בחר תאריך ושעה עתידיים" });

    const result = await pool.query(
      `UPDATE invites
       SET accepted = TRUE, status = 'confirmed', date_type = $2, date_value = $3, time_value = $4, note = $5, responded_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id, dateType, date, time, note]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Invitation not found" });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

app.get("/api/admin/invites", requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, name, message, status, accepted,
             date_type AS "dateType", date_value AS "date", time_value AS "time",
             note, created_at AS "createdAt", responded_at AS "respondedAt"
      FROM invites ORDER BY created_at DESC LIMIT 500
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  next();
});
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

await initDb();
app.listen(PORT, "0.0.0.0", () => console.log(`Date Time listening on port ${PORT}`));
