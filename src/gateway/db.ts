import { mkdirSync } from "node:fs";

/**
 * Storage: accounts (API key hashes, balances), usage and receipts. Never prompts or responses.
 * DATABASE_URL → Postgres over Neon's HTTP driver; otherwise an embedded Postgres (PGlite) in ./.data for development.
 */
type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

let q: Promise<Query> | null = null;

async function open(): Promise<Query> {
  const url = process.env.DATABASE_URL?.trim();
  let run: Query;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    run = async (text, params = []) => (await sql.query(text, params)) as never;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    mkdirSync(".data", { recursive: true });
    const db = new PGlite(".data/pglite");
    run = async (text, params = []) => (await db.query(text, params)).rows as never;
  }
  for (const stmt of SCHEMA) await run(stmt);
  return run;
}

const SCHEMA = [
  `create table if not exists accounts (
     id text primary key,
     key_hash text unique not null,
     label text,
     balance_micros bigint not null default 0,
     created_at timestamptz not null default now())`,
  `create table if not exists usage (
     id bigserial primary key,
     account_id text not null,
     listing text not null,
     input_tokens integer not null,
     output_tokens integer not null,
     cost_micros bigint not null,
     receipt_id text,
     created_at timestamptz not null default now())`,
  `create index if not exists usage_account on usage (account_id, created_at)`,
  `alter table accounts add column if not exists deposit_code text unique`,
  `create table if not exists deposits (
     signature text primary key,
     account_id text,
     amount_micros bigint not null,
     memo text,
     seen_at timestamptz not null default now())`,
  `create table if not exists receipts (
     id text primary key,
     account_id text not null,
     body jsonb not null,
     signature text not null,
     anchor jsonb,
     created_at timestamptz not null default now())`,
];

export function db(): Promise<Query> {
  q ??= open().catch((e) => {
    q = null;
    throw e;
  });
  return q;
}
