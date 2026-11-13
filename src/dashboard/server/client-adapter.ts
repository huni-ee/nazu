/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type Database from 'better-sqlite3';
import type { DashboardBridge, DashboardChannel, DashboardClient } from './types.js';

const pageSize = 500;

function openLinkTags(value: unknown, tagType?: number): string[] {
  if (typeof value !== 'string') return [];
  try {
    const tags: unknown = JSON.parse(value);
    if (!Array.isArray(tags)) return [];
    const entries: readonly unknown[] = tags;
    return entries.flatMap((tag) => {
      if (tag === null || typeof tag !== 'object' || !('c' in tag)) return [];
      if (tagType !== undefined && (!('t' in tag) || tag.t !== tagType)) return [];
      return typeof tag.c === 'string' && tag.c.trim() ? [tag.c] : [];
    });
  } catch {
    return [];
  }
}

function description(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** ArisaClient의 조회 기능을 대시보드에서 사용한다. */
export function createClientAdapter(bridge: DashboardBridge): DashboardClient {
  const initializedDatabases = new WeakSet<Database.Database>();

  // rawQuery의 기본 행 제한 안에서 SQL 페이지를 나누어 요청한다.
  async function queryPages(
    sql: string,
    params: readonly (string | number | boolean | null)[] = [],
    maximum = 10000
  ): Promise<Record<string, unknown>[]> {
    const result: Record<string, unknown>[] = [];
    while (result.length < maximum) {
      const limit = Math.min(pageSize, maximum - result.length);
      const rows = await bridge.query(`${sql}\nLIMIT ? OFFSET ?`, [...params, limit, result.length], limit);
      result.push(...rows);
      if (rows.length < limit) break;
    }
    return result;
  }

  return {
    target: bridge.target,
    botName: bridge.botName,
    healthCheck: () => bridge.healthCheck(),
    query: (sql, params, limit) => bridge.query(sql, params, limit),
    decrypt: (ciphertext, enc, userId) => bridge.decrypt(ciphertext, enc, userId),
    getCredential: () => bridge.getCredential(),
    getAccountId: () => bridge.getAccountId(),
    setAccountId: (userId) => bridge.setAccountId(userId),
    getChannel: (channelId) => bridge.getChannel(channelId),
    openMediaStream: (channelId, count, mode) => bridge.openMediaStream(channelId, count, mode),
    getUser: (userId) => bridge.getUser(userId),
    getOpenUser: (userId) => bridge.getOpenUser(userId),
    getDatabase() {
      const database = bridge.getDatabase();
      if (!initializedDatabases.has(database)) {
        database.exec(`
          CREATE TABLE IF NOT EXISTS dashboard_user_label (
            user_id TEXT NOT NULL PRIMARY KEY,
            name TEXT NOT NULL
          );
        `);
        initializedDatabases.add(database);
      }
      return database;
    },
    async listChannels() {
      const rows = await queryPages(`
        SELECT CAST(id AS TEXT) AS id
        FROM db1.chat_rooms
        ORDER BY last_updated_at DESC, last_log_id DESC, id DESC
      `);
      const ids = [
        ...new Set(
          rows
            .filter((row) => row.id !== undefined && row.id !== null)
            .map((row) => String(row.id))
            .filter((id) => id !== 'undefined' && id !== 'null')
        )
      ];
      const channels: DashboardChannel[] = [];
      let firstError: unknown;
      for (let index = 0; index < ids.length; index += 8) {
        const batch = await Promise.allSettled(ids.slice(index, index + 8).map((id) => bridge.getChannel(id)));
        for (const entry of batch) {
          if (entry.status === 'fulfilled') channels.push(entry.value);
          else firstError ??= entry.reason;
        }
      }
      if (channels.length === 0 && firstError !== undefined) {
        throw firstError instanceof Error ? firstError : new Error(String(firstError));
      }
      return channels;
    },
    async getChannelMemberCounts() {
      const rows = await queryPages(`
        SELECT CAST(room.id AS TEXT) AS channel_id,
               CASE WHEN json_valid(room.active_member_ids)
                    THEN CASE WHEN json_type(room.active_member_ids) = 'array'
                              THEN json_array_length(room.active_member_ids)
                         END
               END AS member_count
        FROM db1.chat_rooms AS room
        ORDER BY room.last_updated_at DESC, room.last_log_id DESC, room.id DESC
      `);
      const counts = new Map<string, number>();
      for (const row of rows) {
        if (row.channel_id === null || row.channel_id === undefined) continue;
        if (row.member_count === null || row.member_count === undefined) continue;
        const count = Number(row.member_count);
        if (Number.isSafeInteger(count) && count >= 0) counts.set(String(row.channel_id), count);
      }
      return counts;
    },
    async getOwnOpenProfiles(userId) {
      const rows = await queryPages(
        `
          SELECT CAST(link.id AS TEXT) AS link_id,
                 COALESCE(NULLIF(profile.nickname, ''), link.name) AS profile_name,
                 COALESCE(
                   NULLIF(profile.profile_image_url, ''),
                   NULLIF(profile.f_profile_image_url, ''),
                   NULLIF(profile.o_profile_image_url, '')
                 ) AS avatar_url,
                 COALESCE(NULLIF(json_extract(link.v, '$.op.desc'), ''), link.description) AS profile_description,
                 json_extract(link.v, '$.op.tags') AS profile_tags,
                 link.url AS profile_url,
                 link.created_at AS created_at,
                 link.active AS is_active,
                 link.expired AS is_expired
          FROM db2.open_link AS link
          JOIN db2.open_profile AS profile
            ON profile.link_id = link.id
           AND profile.user_id = link.user_id
          WHERE link.user_id = ?
            AND link.type = 1
            AND CASE WHEN json_valid(link.v) THEN json_type(link.v, '$.op') = 'object' ELSE 0 END
          ORDER BY link.created_at DESC, link.id DESC
        `,
        [userId],
        1000
      );
      return rows.map((row) => ({
        id: String(row.link_id),
        name: String(row.profile_name ?? ''),
        profileImageUrl: row.avatar_url ? String(row.avatar_url) : null,
        description: description(row.profile_description),
        tags: openLinkTags(row.profile_tags),
        url: String(row.profile_url ?? ''),
        createdAt: Number(row.created_at),
        active: Number(row.is_active) === 1,
        expired: Number(row.is_expired) === 1
      }));
    },
    async getOwnOpenProfileChannelLinks(userId) {
      const rows = await queryPages(
        `
          SELECT CAST(room.id AS TEXT) AS channel_id,
                 CAST(link.id AS TEXT) AS profile_id
          FROM db1.chat_rooms AS room
          JOIN db2.open_link AS link ON link.id = room.link_id
          WHERE room.type = 'OD'
            AND link.user_id = ?
            AND link.type = 1
            AND CASE WHEN json_valid(link.v) THEN json_type(link.v, '$.op') = 'object' ELSE 0 END
            AND EXISTS (
              SELECT 1 FROM db2.open_profile AS profile
              WHERE profile.link_id = link.id AND profile.user_id = link.user_id
            )
          ORDER BY room.last_updated_at DESC, room.last_log_id DESC, room.id DESC
        `,
        [userId]
      );
      return new Map(rows.map((row) => [String(row.channel_id), String(row.profile_id)]));
    },
    async getOwnOpenProfileHomeChannelIds(userId) {
      const rows = await queryPages(
        `
          SELECT CAST(room.id AS TEXT) AS channel_id
          FROM db1.chat_rooms AS room
          JOIN db2.open_link AS link ON link.id = room.link_id
          WHERE room.type = 'OD'
            AND link.user_id = ?
            AND link.type = 1
            AND CASE WHEN json_valid(link.v) THEN json_type(link.v, '$.op') = 'object' ELSE 0 END
            AND EXISTS (
              SELECT 1 FROM db2.open_profile AS profile
              WHERE profile.link_id = link.id AND profile.user_id = link.user_id
            )
            AND CASE WHEN json_valid(room.v) THEN
              json_type(room.v, '$.openlinkHome') = 'true'
              AND json_type(room.v, '$.display_user_ids') = 'text'
              AND json_extract(room.v, '$.display_user_ids') = CAST(link.user_id AS TEXT)
            ELSE 0 END
          ORDER BY room.last_updated_at DESC, room.last_log_id DESC, room.id DESC
        `,
        [userId]
      );
      return new Set(rows.map((row) => String(row.channel_id)));
    },
    async getOwnDirectOpenChats(userId) {
      const rows = await queryPages(
        `
          SELECT CAST(link.id AS TEXT) AS link_id,
                 link.name AS room_name,
                 link.image_url AS image_url,
                 link.description AS room_description,
                 json_extract(json_extract(link.v, '$.meta'), '$.tags') AS room_tags,
                 link.url AS room_url,
                 link.created_at AS created_at
          FROM db2.open_link AS link
          WHERE link.user_id = ?
            AND link.type = 1
            AND CASE WHEN link.v IS NULL THEN 1
                     WHEN json_valid(link.v) THEN COALESCE(json_type(link.v, '$.op'), 'null') = 'null'
                     ELSE 0 END
          ORDER BY link.created_at DESC, link.id DESC
        `,
        [userId],
        1000
      );
      return rows.map((row) => ({
        id: String(row.link_id),
        name: String(row.room_name ?? ''),
        imageUrl: row.image_url ? String(row.image_url) : null,
        description: description(row.room_description),
        tags: openLinkTags(row.room_tags, 2),
        url: String(row.room_url ?? ''),
        createdAt: Number(row.created_at)
      }));
    },
    async getOwnDirectOpenChatChannels(userId) {
      const rows = await queryPages(
        `
          SELECT CAST(room.id AS TEXT) AS channel_id,
                 CAST(link.id AS TEXT) AS link_id,
                 CASE WHEN json_valid(room.v) THEN
                   json_type(room.v, '$.openlinkHome') = 'true'
                   AND json_type(room.v, '$.display_user_ids') = 'text'
                   AND json_extract(room.v, '$.display_user_ids') = CAST(link.user_id AS TEXT)
                 ELSE 0 END AS is_home
          FROM db1.chat_rooms AS room
          JOIN db2.open_link AS link ON link.id = room.link_id
          WHERE room.type = 'OD'
            AND link.user_id = ?
            AND link.type = 1
            AND CASE WHEN link.v IS NULL THEN 1
                     WHEN json_valid(link.v) THEN COALESCE(json_type(link.v, '$.op'), 'null') = 'null'
                     ELSE 0 END
          ORDER BY room.last_updated_at DESC, room.last_log_id DESC, room.id DESC
        `,
        [userId]
      );
      return {
        links: new Map(rows.map((row) => [String(row.channel_id), String(row.link_id)])),
        homeChannelIds: new Set(rows.filter((row) => Number(row.is_home) === 1).map((row) => String(row.channel_id)))
      };
    },
    async getOwnOpenChatRooms(userId) {
      const rows = await queryPages(
        `
          SELECT CAST(link.id AS TEXT) AS link_id,
                 link.type AS link_type,
                 link.name AS room_name,
                 link.image_url AS image_url,
                 link.description AS room_description,
                 json_extract(json_extract(link.v, '$.meta'), '$.tags') AS room_tags,
                 link.url AS room_url,
                 link.created_at AS created_at
          FROM db2.open_link AS link
          WHERE link.user_id = ?
            AND link.type IN (2, 8)
          ORDER BY link.created_at DESC, link.id DESC
        `,
        [userId],
        1000
      );
      return rows.map((row) => ({
        id: String(row.link_id),
        kind: Number(row.link_type) === 8 ? 'community' : 'group',
        name: String(row.room_name ?? ''),
        imageUrl: row.image_url ? String(row.image_url) : null,
        description: description(row.room_description),
        tags: openLinkTags(row.room_tags, 2),
        url: String(row.room_url ?? ''),
        createdAt: Number(row.created_at)
      }));
    }
  };
}
