import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  stripe_customer_id TEXT, sub_status TEXT, sub_period_end INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS categories(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS modifiers(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, category_id TEXT NOT NULL, text TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0, usage_count INTEGER NOT NULL DEFAULT 0,
  parent_id TEXT, archived INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS generations(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, model TEXT NOT NULL, kind TEXT NOT NULL,
  free_text TEXT, prompt TEXT NOT NULL, source_file TEXT, result_file TEXT,
  status TEXT NOT NULL, error TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS generation_modifiers(
  generation_id TEXT NOT NULL, modifier_id TEXT NOT NULL, text TEXT NOT NULL,
  PRIMARY KEY(generation_id, modifier_id));
CREATE TABLE IF NOT EXISTS presets(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, free_text TEXT, ref_file TEXT,
  modifier_ids TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_presets_user ON presets(user_id, created_at);
-- Huella (sha256) de cada archivo del usuario: si sube la misma imagen otra vez se reutiliza el archivo ya guardado.
CREATE TABLE IF NOT EXISTS file_hashes(
  user_id TEXT NOT NULL, hash TEXT NOT NULL, file TEXT NOT NULL, PRIMARY KEY(user_id, hash));
CREATE TABLE IF NOT EXISTS hero_images(
  id TEXT PRIMARY KEY, file TEXT NOT NULL, sort INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS plans(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price_cents INTEGER NOT NULL, tokens INTEGER NOT NULL,
  features TEXT NOT NULL DEFAULT '[]', highlighted INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0, stripe_product_id TEXT);
CREATE TABLE IF NOT EXISTS token_packs(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, tokens INTEGER NOT NULL, price_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0);
-- Enlaces de recuperación de contraseña (solo se guarda el hash del token; vencen en 1 hora).
CREATE TABLE IF NOT EXISTS password_resets(
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS model_tokens(
  model_id TEXT PRIMARY KEY, tokens_override INTEGER, enabled INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS token_ledger(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, delta INTEGER NOT NULL, balance_after INTEGER NOT NULL,
  type TEXT NOT NULL, note TEXT, ref TEXT, actor_id TEXT, created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_ref ON token_ledger(type, ref) WHERE ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ledger_user ON token_ledger(user_id, created_at);
CREATE TABLE IF NOT EXISTS payments(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, item_id TEXT, item_name TEXT,
  amount_cents INTEGER NOT NULL, tokens INTEGER NOT NULL, status TEXT NOT NULL,
  refunded_cents INTEGER NOT NULL DEFAULT 0, tokens_revoked INTEGER NOT NULL DEFAULT 0,
  stripe_ref TEXT, payment_intent TEXT, created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pay_ref ON payments(stripe_ref) WHERE stripe_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pay_user ON payments(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pay_pi ON payments(payment_intent);
CREATE INDEX IF NOT EXISTS idx_mod_user ON modifiers(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_gen_user ON generations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_genmod_mod ON generation_modifiers(modifier_id);
`;

// Migraciones incrementales sobre tablas ya creadas (ignora el error si la columna ya existe).
const MIGRATIONS = [
  "ALTER TABLE generations ADD COLUMN source_deleted_at INTEGER",
  "ALTER TABLE generations ADD COLUMN aspect_ratio TEXT",
  "ALTER TABLE generations ADD COLUMN cost_usd REAL",
  "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
  "ALTER TABLE generations ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE generations ADD COLUMN source_public INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE modifiers ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE modifiers ADD COLUMN origin_file TEXT",
  "ALTER TABLE users ADD COLUMN tokens INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE users ADD COLUMN plan_id TEXT",
  "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT",
  "ALTER TABLE users ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE generations ADD COLUMN tokens_spent INTEGER",
  "ALTER TABLE presets ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0",
  // Las cuentas que ya existían se consideran con el tutorial visto; las nuevas se registran con 0.
  "ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 1",
  "ALTER TABLE users ADD COLUMN google_sub TEXT",
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google ON users(google_sub)",
  "ALTER TABLE presets ADD COLUMN instructions TEXT",
  "ALTER TABLE presets ADD COLUMN materials TEXT",
  "ALTER TABLE users ADD COLUMN name TEXT",
  "ALTER TABLE users ADD COLUMN phone TEXT",
  // Modo del Studio al que pertenece el preset (los anteriores son del Estudio Pro).
  "ALTER TABLE presets ADD COLUMN mode TEXT NOT NULL DEFAULT 'pro'",
  "ALTER TABLE generations ADD COLUMN mode TEXT",
  // Estudio Pro: qué categorías se toman de cada material ({archivo: [slugs]}).
  "ALTER TABLE presets ADD COLUMN material_roles TEXT",
  "ALTER TABLE presets ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0",
  // Preset con el que se hizo la generación (para mostrar sus resultados en la tarjeta).
  "ALTER TABLE generations ADD COLUMN preset_id TEXT",
];
const DB_VERSION = 19; // súbelo al agregar migraciones para que el servidor en caliente las aplique

const g = globalThis as unknown as { __db?: Client; __dbReady?: Promise<unknown>; __dbVer?: number };

async function client(): Promise<Client> {
  if (!g.__db || g.__dbVer !== DB_VERSION) {
    mkdirSync(path.join(process.cwd(), "data"), { recursive: true });
    const db = createClient({
      url: process.env.DATABASE_URL ?? "file:data/app.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    g.__db = db;
    g.__dbVer = DB_VERSION;
    g.__dbReady = db.executeMultiple(SCHEMA).then(async () => {
      for (const sql of MIGRATIONS) await db.execute(sql).catch(() => {});
    });
  }
  await g.__dbReady;
  return g.__db;
}

export async function query<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
  const rs = await (await client()).execute({ sql, args });
  return rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])) as T);
}

export async function one<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T | null> {
  return (await query<T>(sql, args))[0] ?? null;
}

export async function run(sql: string, args: InValue[] = []) {
  return (await client()).execute({ sql, args });
}

export async function batch(stmts: { sql: string; args?: InValue[] }[]) {
  return (await client()).batch(
    stmts.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
    "write",
  );
}

export const uid = () => crypto.randomUUID();
