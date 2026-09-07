import { createClient, type Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';

// Works two ways depending on env vars:
// - Local dev / VPS: TURSO_DATABASE_URL unset -> falls back to a local file
//   at DATA_DIR/kurs.db (still via libsql's local-file driver).
// - Vercel + Turso: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (from your
//   Turso dashboard) and the same code talks to the hosted database instead.
// This is why the whole app is written against this one async client rather
// than a synchronous file-only driver — it has to run unmodified in both
// places.
declare global {
  // eslint-disable-next-line no-var
  var __kursClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __kursInit: Promise<void> | undefined;
}

function client(): Client {
  if (!global.__kursClient) {
    const url = process.env.TURSO_DATABASE_URL || `file:${process.env.DATA_DIR || './data'}/kurs.db`;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (url.startsWith('file:')) {
      const filePath = url.slice('file:'.length);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) fs.mkdirSync(/*turbopackIgnore: true*/ dir, { recursive: true });
    }
    global.__kursClient = createClient({ url, authToken });
  }
  return global.__kursClient;
}

export async function dbAll(sql: string, params: any[] = []): Promise<any[]> {
  await ensureInit();
  const res = await client().execute({ sql, args: params });
  return res.rows.map((r) => Object.fromEntries(res.columns.map((c, i) => [c, r[i]])));
}

export async function dbGet(sql: string, params: any[] = []): Promise<any | undefined> {
  const rows = await dbAll(sql, params);
  return rows[0];
}

export async function dbRun(sql: string, params: any[] = []): Promise<{ lastInsertRowid: bigint | undefined; rowsAffected: number }> {
  await ensureInit();
  const res = await client().execute({ sql, args: params });
  return { lastInsertRowid: res.lastInsertRowid, rowsAffected: res.rowsAffected };
}

// Runs several statements atomically. Pass a list of {sql, args} — libsql's
// batch() is atomic (all-or-nothing), matching the guarantee transitionOrder()
// and order creation rely on.
export async function dbBatch(statements: { sql: string; args?: any[] }[]) {
  await ensureInit();
  return client().batch(
    statements.map((s) => ({ sql: s.sql, args: s.args || [] })),
    'write'
  );
}

function ensureInit(): Promise<void> {
  if (!global.__kursInit) {
    // If init() ever throws (a transient DB hiccup, a migration race that
    // slips past the guard above, etc.), don't cache the failure forever —
    // clear it so the next request gets a fresh attempt instead of every
    // request on this warm instance failing until it's recycled.
    global.__kursInit = init().catch((e) => {
      global.__kursInit = undefined;
      throw e;
    });
  }
  return global.__kursInit;
}

async function init() {
  const c = client();
  await c.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      kyc_status TEXT NOT NULL DEFAULT 'none',
      kyc_level INTEGER NOT NULL DEFAULT 0,
      kyc_photo TEXT,
      kyc_photo_document TEXT,
      kyc_photo_selfie TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      twofa_enabled INTEGER NOT NULL DEFAULT 0,
      twofa_secret TEXT,
      antiphishing_code TEXT,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      verify_code TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS balances (
      user_id TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, currency)
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS pairs (
      id TEXT PRIMARY KEY,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      spread_bps INTEGER NOT NULL DEFAULT 50,
      min_usd REAL NOT NULL DEFAULT 3,
      max_usd REAL NOT NULL DEFAULT 50000,
      UNIQUE(from_currency, to_currency)
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      public_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      from_currency TEXT NOT NULL,
      to_currency TEXT NOT NULL,
      amount_from REAL NOT NULL,
      amount_to REAL NOT NULL,
      rate REAL NOT NULL,
      partner_rate REAL NOT NULL,
      spread_usd REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      dest TEXT NOT NULL,
      payout_address TEXT,
      deposit_address TEXT,
      risk_score INTEGER NOT NULL DEFAULT 0,
      tx_in TEXT,
      tx_out TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS order_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      actor TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_email TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await c.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  // Withdrawal requests. Balance is debited (reserved) the moment a request
  // is created, but the actual on-chain send is done by a human admin —
  // status starts 'pending' and only becomes 'completed' (funds genuinely
  // sent) or 'rejected' (balance refunded) via admin action.
  await c.execute(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      coin TEXT NOT NULL,
      amount REAL NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);
  // Free-form messages an admin sends to one specific user, e.g. to ask a
  // question about a withdrawal or KYC document. Shown to the user as a
  // banner until they mark it read.
  await c.execute(`
    CREATE TABLE IF NOT EXISTS admin_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      admin_email TEXT NOT NULL,
      message TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Admin-assigned deposit address per (user, coin). When set, the user's
  // wallet page shows THIS address instead of the display-only fake one
  // from lib/coins.ts::addressFor() — and real on-chain deposit checking
  // (lib/tron.ts) watches it. The platform never holds a private key for
  // these addresses; whoever set the address (admin, pointing at a wallet
  // they or the user already control) holds the key. This is deliberately
  // the safer starting point before any platform-custodied wallet exists.
  await c.execute(`
    CREATE TABLE IF NOT EXISTS wallet_overrides (
      user_id TEXT NOT NULL,
      coin TEXT NOT NULL,
      address TEXT NOT NULL,
      set_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, coin)
    )
  `);
  // Idempotency ledger for on-chain deposits: one row per real blockchain
  // transaction we've credited. tx_id is UNIQUE so the same transfer can
  // never be credited twice even if the deposit-check endpoint is called
  // concurrently or repeatedly.
  await c.execute(`
    CREATE TABLE IF NOT EXISTS crypto_deposits (
      tx_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      coin TEXT NOT NULL,
      amount REAL NOT NULL,
      address TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Manual wallet top-up claims for every coin that has no automated
  // on-chain check (i.e. not real USDT/TRC20 — see wallet_overrides above).
  // The user's claimed amount never touches balances by itself; an admin
  // checks the address on a block explorer and confirms/rejects from
  // /admin/deposits, which is what actually credits the balance.
  await c.execute(`
    CREATE TABLE IF NOT EXISTS deposit_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      coin TEXT NOT NULL,
      amount REAL NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);

  const coins = ['USDT', 'USDC', 'ETH', 'BTC', 'SOL', 'TON', 'TRX'];
  for (const a of coins) {
    for (const b of coins) {
      if (a === b) continue;
      await c.execute({
        sql: `INSERT OR IGNORE INTO pairs (id, from_currency, to_currency, enabled, spread_bps, min_usd, max_usd) VALUES (?,?,?,1,50,3,50000)`,
        args: [`${a}_${b}`, a, b],
      });
    }
  }

  const settingDefaults: [string, string][] = [
    ['kill_switch', '0'],
    ['quote_ttl_seconds', '900'],
    ['limit_l0', '1000'],
    ['limit_l1', '50000'],
  ];
  for (const [k, v] of settingDefaults) {
    await c.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, args: [k, v] });
  }

  // Safe migration for databases created before these columns existed:
  // CREATE TABLE IF NOT EXISTS above only applies to brand-new databases,
  // so an already-deployed database needs these added explicitly. SQLite
  // has no "ADD COLUMN IF NOT EXISTS", and on a serverless host multiple
  // cold starts can race this check-then-add — so each ALTER is wrapped to
  // ignore a "column already exists" error from a concurrent instance
  // rather than letting it fail the whole startup.
  const existingCols = await c.execute(`PRAGMA table_info(users)`);
  const colNames = new Set(existingCols.rows.map((r: any) => r.name));
  for (const col of ['kyc_photo_document', 'kyc_photo_selfie', 'twofa_secret']) {
    if (colNames.has(col)) continue;
    try {
      await c.execute(`ALTER TABLE users ADD COLUMN ${col} TEXT`);
    } catch (e: any) {
      if (!/duplicate column/i.test(e?.message || '')) throw e;
    }
  }

  // One-time migration: existing deployments already have 42 pair rows
  // seeded at the old 0.9% (90 bps) default — INSERT OR IGNORE above only
  // affects rows that don't exist yet, so already-seeded pairs need an
  // explicit update. Guarded by a settings flag so it runs exactly once and
  // never fights an admin's own later spread changes on restart.
  const spreadMigrated = await c.execute(`SELECT value FROM settings WHERE key='migrated_spread_v1'`);
  if (spreadMigrated.rows.length === 0) {
    await c.execute(`UPDATE pairs SET spread_bps = 50 WHERE spread_bps = 90`);
    await c.execute({
      sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('migrated_spread_v1', '1')`,
      args: [],
    });
  }

  // One-time migration: drop the old $10 minimum-order-size default to $3
  // for every pair still sitting at the old seeded value. Guarded the same
  // way as the spread migration above so it never fights an admin who has
  // since set their own min_usd on a pair (only rows still exactly at the
  // old default of 10 get touched, and only once).
  const minUsdMigrated = await c.execute(`SELECT value FROM settings WHERE key='migrated_min_usd_v1'`);
  if (minUsdMigrated.rows.length === 0) {
    await c.execute(`UPDATE pairs SET min_usd = 3 WHERE min_usd = 10`);
    await c.execute({
      sql: `INSERT OR IGNORE INTO settings (key, value) VALUES ('migrated_min_usd_v1', '1')`,
      args: [],
    });
  }

  const adminExists = await c.execute(`SELECT id FROM users WHERE role IN ('admin','superadmin') LIMIT 1`);
  if (adminExists.rows.length === 0) {
    const bcrypt = require('bcryptjs');
    await c.execute({
      sql: `INSERT INTO users (id, email, password_hash, name, role, kyc_status, kyc_level, email_verified, referral_code, antiphishing_code)
            VALUES (?,?,?,?,?,?,?,1,?,?)`,
      args: [
        'admin1',
        'admin@kurs.app',
        bcrypt.hashSync(process.env.ADMIN_SEED_PASSWORD || 'kurs-admin-2026', 10),
        'Администратор',
        'superadmin',
        'approved',
        1,
        'KURS-ADMIN',
        'KRS-0001',
      ],
    });
  }
}
