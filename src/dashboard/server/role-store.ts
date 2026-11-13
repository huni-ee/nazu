/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type Database from 'better-sqlite3';
import type { DashboardMember } from './types.js';
import { isSafeName } from './validation.js';

export type Role = 'admin' | 'ban';

export interface RoleEntry {
  readonly id: string;
  readonly name?: string;
}

export function roleIds(database: Database.Database, role: Role): Set<string> {
  const rows = database.prepare<[], { readonly user_id: string }>(`SELECT user_id FROM ${role}`).all();
  return new Set(rows.map((row) => row.user_id));
}

export function roleList(database: Database.Database, role: Role): RoleEntry[] {
  const rows = database
    .prepare<[], { readonly id: string; readonly name: string | null }>(
      `SELECT r.user_id AS id, l.name AS name
       FROM ${role} AS r
       LEFT JOIN dashboard_user_label AS l ON l.user_id = r.user_id
       ORDER BY COALESCE(l.name, r.user_id) COLLATE NOCASE`
    )
    .all();
  return rows.map((row) => (row.name === null ? { id: row.id } : { id: row.id, name: row.name }));
}

/** 관리자·밴 유저의 이름을 기억해 두었다가, 방 밖에서도 목록에 이름으로 표시한다. */
export function saveKnownNames(
  database: Database.Database,
  members: readonly Pick<DashboardMember, 'id' | 'name'>[],
  admins: Set<string>,
  banned: Set<string>
): void {
  if (admins.size === 0 && banned.size === 0) return;
  const upsert = database.prepare<[string, string]>(`INSERT INTO dashboard_user_label (user_id, name) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET name = excluded.name WHERE name <> excluded.name`);
  const save = database.transaction(() => {
    for (const member of members) {
      if ((admins.has(member.id) || banned.has(member.id)) && isSafeName(member.name)) {
        upsert.run(member.id, member.name);
      }
    }
  });
  save();
}

export function changeRole(
  database: Database.Database,
  role: Role,
  userId: string,
  enabled: boolean,
  name?: string
): void {
  const update = database.transaction(() => {
    if (enabled) {
      database.prepare<[string]>(`INSERT OR IGNORE INTO ${role} (user_id) VALUES (?)`).run(userId);
    } else {
      database.prepare<[string]>(`DELETE FROM ${role} WHERE user_id = ?`).run(userId);
    }
    if (name !== undefined) {
      database
        .prepare<[string, string]>(
          `INSERT INTO dashboard_user_label (user_id, name) VALUES (?, ?)
           ON CONFLICT(user_id) DO UPDATE SET name = excluded.name WHERE name <> excluded.name`
        )
        .run(userId, name);
    }
    if (!enabled) {
      database
        .prepare<[string, string, string]>(
          `DELETE FROM dashboard_user_label
           WHERE user_id = ?
             AND NOT EXISTS (SELECT 1 FROM admin WHERE user_id = ?)
             AND NOT EXISTS (SELECT 1 FROM ban WHERE user_id = ?)`
        )
        .run(userId, userId, userId);
    }
  });
  update();
}
