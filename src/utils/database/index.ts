/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

let database: Database.Database | null = null;

/** 데이터베이스를 초기화한다. */
export function initDatabase(): Database.Database {
  if (database !== null) return database;

  const directory = join(process.cwd(), 'data');
  mkdirSync(directory, { recursive: true });

  const openedDatabase = new Database(join(directory, 'arisa.db'));
  try {
    openedDatabase.transaction(() => {
      openedDatabase.exec(`
        CREATE TABLE IF NOT EXISTS account (
          user_id TEXT NOT NULL PRIMARY KEY,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS admin (
          user_id TEXT NOT NULL PRIMARY KEY
        );

        CREATE TABLE IF NOT EXISTS ban (
          user_id TEXT NOT NULL PRIMARY KEY
        );
      `);
      migrateAuth(openedDatabase);
    })();
  } catch (error) {
    openedDatabase.close();
    throw error;
  }

  database = openedDatabase;
  return openedDatabase;
}

/** 데이터베이스를 가져온다. */
export function getDatabase(): Database.Database | null {
  return database;
}

/** 기존 인증 기록을 계정 ID별로 옮긴다. 잘못된 기록이 있으면 원본 테이블을 유지한다. */
function migrateAuth(database: Database.Database): void {
  const legacyTable = database
    .prepare<[string], { readonly name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get('auth');
  if (legacyTable === undefined) return;

  const rows = database.prepare<[], { readonly data: string }>('SELECT data FROM auth').all();
  const accounts: { readonly userId: string; readonly data: string }[] = [];
  for (const row of rows) {
    const userId = legacyAccountId(row.data);
    if (userId === null) return;
    accounts.push({ userId, data: row.data });
  }

  const insert = database.prepare<[string, string]>(
    'INSERT INTO account (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO NOTHING'
  );
  for (const account of accounts) insert.run(account.userId, account.data);
  database.exec('DROP TABLE auth');
}

function legacyAccountId(data: string): string | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object' || !('raw' in value)) return null;
  const raw = value.raw;
  if (raw === null || typeof raw !== 'object' || !('user' in raw)) return null;
  const user = raw.user;
  if (user === null || typeof user !== 'object' || !('userId' in user)) return null;
  const userId = user.userId;
  if (typeof userId === 'string' && /^[1-9]\d*$/.test(userId)) return userId;
  if (typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0) return String(userId);
  return null;
}
