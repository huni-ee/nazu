/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { MessageScope } from './generated/arisa.pb.js';
import type { ArisaGrpc } from './arisa-grpc.js';
import type { NormalChannelType, OpenChannelInfo, OpenChannelType } from '../types/channel.js';
import { isLongId } from '../utils/id/index.js';
import { JsonUtil } from '../utils/json/index.js';
import type {
  LeaveInfo,
  LogDirection,
  MessageCount,
  MessageRow,
  NormalBotRow,
  OpenProfileRow,
  Store
} from './store.js';

type GrpcAccess = Pick<ArisaGrpc, 'rawQuery' | 'decrypt'>;

export class GrpcStore implements Store {
  constructor(private readonly grpc: GrpcAccess) {}

  /** 메세지를 읽은 유저 아이디를 조회한다. */
  async getReaderIds(channelId: string, logId: string, read: boolean): Promise<string[]> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT room.active_member_ids AS member_ids,
               room.watermarks AS read_marks
        FROM db1.chat_rooms AS room
        WHERE room.id = ?
        LIMIT 1
      `,
      [channelId]
    );
    const room = rows[0];
    if (room === undefined) return [];

    const memberIds = JsonUtil.parseLossless<unknown[]>(String(room.member_ids ?? '[]')).map(String);
    const readMarks = JsonUtil.parseLossless<unknown[]>(String(room.read_marks ?? '[]')).map(String);
    const targetId = BigInt(logId);

    return memberIds.filter((_userId, index) => {
      const mark = readMarks[index];
      if (mark === undefined) return !read;
      return read ? BigInt(mark) >= targetId : BigInt(mark) < targetId;
    });
  }

  /** 기준 메세지에서 떨어진 메세지 아이디를 조회한다. */
  async getNearbyLogId(
    channelId: string,
    logId: string,
    count: number,
    direction: LogDirection
  ): Promise<string | null> {
    const after = direction === 'after';
    const rows = await this.grpc.rawQuery(
      `
        SELECT log.id AS log_id
        FROM db1.chat_logs AS log
        WHERE log.chat_id = ?
          AND log.id ${after ? '>' : '<'} ?
        ORDER BY log.id ${after ? 'ASC' : 'DESC'}
        LIMIT 1 OFFSET ?
      `,
      [channelId, logId, count - 1],
      1
    );
    const found = rows[0]?.log_id;
    return found === undefined || found === null ? null : String(found);
  }

  /** 저장된 메세지 내용을 복호화해 조회한다. */
  async getMessageRow(channelId: string, logId: string): Promise<MessageRow> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT log.type AS message_type,
               log.scope AS message_scope,
               log.thread_id AS thread_id,
               log.user_id AS sender_id,
               log.v AS detail_json,
               log.message AS message_text,
               log.attachment AS attachment_text
        FROM db1.chat_logs AS log
        WHERE log.chat_id = ?
          AND log.id = ?
        LIMIT 1
      `,
      [channelId, logId]
    );
    const row = rows[0];
    if (row === undefined) throw new Error('메세지를 찾을 수 없습니다.');

    const userId = String(row.sender_id);
    const detail =
      row.detail_json === undefined || row.detail_json === null
        ? {}
        : JsonUtil.parseLossless<{ enc?: number }>(String(row.detail_json));
    const enc = Number(detail.enc ?? 0);
    const attachment =
      row.attachment_text === undefined || row.attachment_text === null
        ? '{}'
        : this.grpc.decrypt(String(row.attachment_text), enc, userId);
    const [message, attachmentJson] = await Promise.all([
      this.grpc.decrypt(String(row.message_text ?? ''), enc, userId),
      attachment
    ]);
    const scopeNumber = Number(row.message_scope);
    let scope = MessageScope.MESSAGE_SCOPE_UNKNOWN;
    if (scopeNumber === 1) scope = MessageScope.MESSAGE_SCOPE_CHANNEL;
    else if (scopeNumber === 2) scope = MessageScope.MESSAGE_SCOPE_THREAD;
    else if (scopeNumber === 3) scope = MessageScope.MESSAGE_SCOPE_ALL;

    const messageRow = {
      userId,
      message,
      attachmentJson,
      scope,
      type: Number(row.message_type ?? 0)
    };
    if (row.thread_id === undefined || row.thread_id === null) return messageRow;
    return { ...messageRow, threadId: String(row.thread_id) };
  }

  /** 팀채팅에서 방장·부방장이 메세지를 가렸는지 확인한다. 가리기는 삭제 피드로 온다. */
  async isHiddenByHost(channelId: string, logId: string): Promise<boolean> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT log.v AS detail_json
        FROM db1.chat_logs AS log
        WHERE log.chat_id = ?
          AND log.id = ?
        LIMIT 1
      `,
      [channelId, logId]
    );
    const detail = rows[0]?.detail_json;
    if (typeof detail !== 'string') return false;
    return JsonUtil.parseLossless<{ byHost?: boolean }>(detail).byHost === true;
  }

  /** 유저가 나간 이유를 조회한다. */
  async getLeaveInfo(channelId: string, userId: string): Promise<LeaveInfo> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT log.v AS detail_json,
               log.message AS event_text,
               log.user_id AS sender_id
        FROM db1.chat_logs AS log
        WHERE log.type = 0
          AND log.user_id = ?
          AND log.chat_id = ?
        ORDER BY log._id DESC
        LIMIT 1
      `,
      [userId, channelId]
    );
    const row = rows[0];
    if (row === undefined) return { silent: false, kicked: false };

    const detail = JsonUtil.parseLossless<{ enc?: number }>(String(row.detail_json ?? '{}'));
    const event = JsonUtil.parseLossless<{ hidden?: boolean; kicked?: boolean }>(
      await this.grpc.decrypt(String(row.event_text ?? ''), Number(detail.enc ?? 0), String(row.sender_id))
    );

    return {
      silent: event.hidden === true,
      kicked: event.kicked === true
    };
  }

  /** 최근 메세지 아이디를 조회한다. */
  async getRecentLogIds(channelId: string, count: number): Promise<string[]> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT log.id AS log_id
        FROM db1.chat_logs AS log
        WHERE log.chat_id = ?
        ORDER BY log._id DESC
        LIMIT ?
      `,
      [channelId, count],
      count
    );
    const ids: string[] = [];
    for (const row of rows) {
      if (row.log_id !== undefined && row.log_id !== null) ids.push(String(row.log_id));
    }
    return ids;
  }

  /** 기간별 유저 메세지 수를 조회한다. */
  async getMessageCounts(
    channelId: string,
    startTime: number,
    endTime: number,
    includeFeed: boolean
  ): Promise<MessageCount[]> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT log.user_id AS sender_id,
               COUNT(1) AS total
        FROM db1.chat_logs AS log
        WHERE log.chat_id = ?
          AND log.created_at >= ?
          AND log.created_at <= ?
          AND (log.type <> 0 OR ? = 1)
        GROUP BY log.user_id
      `,
      [channelId, startTime, endTime, includeFeed ? 1 : 0],
      10000
    );
    const counts: MessageCount[] = [];
    for (const row of rows) {
      if (row.sender_id === undefined || row.sender_id === null) continue;
      counts.push({ id: String(row.sender_id), count: Number(row.total ?? 0) });
    }
    return counts;
  }

  /** 채널에 등록된 봇 아이디를 조회한다. */
  async getBotIds(channelId: string): Promise<string[]> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT json_extract(meta_item.value, '$.content') AS bot_json
        FROM db1.chat_rooms AS room
        JOIN json_each(room.meta) AS meta_item
        WHERE room.id = ?
          AND json_extract(meta_item.value, '$.type') = 21
        LIMIT 1
      `,
      [channelId]
    );
    const content = rows[0]?.bot_json;
    if (content === undefined || content === null) return [];

    const data = JsonUtil.parseLossless<{ readonly bots?: { readonly pid: string }[] }>(String(content));
    const botIds: string[] = [];
    for (const bot of data.bots ?? []) {
      const id = String(bot.pid);
      if (!botIds.includes(id)) botIds.push(id);
    }
    return botIds;
  }

  /** 봇 정보를 조회한다. */
  async getBotRows(botIds: readonly string[]): Promise<NormalBotRow[]> {
    if (botIds.length === 0) return [];

    const placeholders = botIds.map(() => '?').join(', ');
    const rows = await this.grpc.rawQuery(
      `
        SELECT bot.id AS bot_id,
               bot.name AS bot_name,
               bot.profile_image_url AS avatar_url
        FROM user.talk_channel AS bot
        WHERE bot.id IN (${placeholders})
      `,
      botIds
    );
    const byId = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const id = String(row.bot_id);
      if (!byId.has(id)) byId.set(id, row);
    }

    const bots: NormalBotRow[] = [];
    for (const botId of botIds) {
      const row = byId.get(botId);
      if (row === undefined) continue;
      bots.push({
        id: botId,
        name: String(row.bot_name ?? ''),
        profileImageUrl: row.avatar_url ? String(row.avatar_url) : null
      });
    }
    return bots;
  }

  /** 일반채팅의 실제 채널 종류를 확인한다. */
  async getNormalRoomType(channelId: string, type: NormalChannelType): Promise<NormalChannelType> {
    if (type !== 'MultiChat') return type;

    const rows = await this.grpc.rawQuery(
      `
        SELECT EXISTS(
          SELECT 1
          FROM db1.warehouse_info AS team
          WHERE team.chat_id = ?
        ) AS has_team_data
      `,
      [channelId]
    );
    return Number(rows[0]?.has_team_data) === 1 ? 'TeamMultiChat' : type;
  }

  /** 팀채팅 방장 아이디를 조회한다. */
  async getTeamHostId(channelId: string): Promise<string | null> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT json_extract(
                 json_extract(meta_item.value, '$.content'),
                 '$.hostId'
               ) AS team_host_id
        FROM db1.chat_rooms AS room
        JOIN json_each(room.meta) AS meta_item
        WHERE room.id = ?
          AND json_extract(meta_item.value, '$.type') = 15
        LIMIT 1
      `,
      [channelId]
    );
    const value = rows[0]?.team_host_id;
    return value ? String(value) : null;
  }

  /** 팀채팅 관리자 아이디를 조회한다. */
  async getTeamModeratorIds(channelId: string): Promise<string[]> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT team.staff AS moderator_ids
        FROM db1.warehouse_info AS team
        WHERE team.chat_id = ?
        LIMIT 1
      `,
      [channelId]
    );
    const value = rows[0]?.moderator_ids;
    return value ? String(value).split(',').filter(Boolean) : [];
  }

  /** 친구 정보에서 설정한 이름을 조회한다. */
  async getFriendName(userId: string): Promise<string | null> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT person.friend_nickname AS friend_name
        FROM user.user AS person
        WHERE person.id = ?
        LIMIT 1
      `,
      [userId]
    );
    const value = rows[0]?.friend_name;
    return value ? String(value) : null;
  }

  /** 오픈채팅의 실제 채널 종류를 확인한다. */
  async getOpenRoomType(channelId: string, type: OpenChannelType): Promise<OpenChannelType> {
    if (type !== 'OM') return type;

    const rows = await this.grpc.rawQuery(
      `
        SELECT EXISTS(
          SELECT 1
          FROM db2.open_link AS link
          WHERE link.id = room.link_id
            AND link.type = 8
        ) AS is_community
        FROM db1.chat_rooms AS room
        WHERE room.id = ?
        LIMIT 1
      `,
      [channelId]
    );
    return Number(rows[0]?.is_community) === 1 ? 'COM' : type;
  }

  /** 오픈채팅방 정보를 조회한다. */
  async getOpenRoomInfo(channelId: string): Promise<OpenChannelInfo | null> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT link.description AS room_description,
               link.created_at AS opened_at,
               link.expired AS is_expired,
               link.active AS is_active,
               link.image_url AS cover_url,
               link.url AS invite_url,
               link.name AS room_name
        FROM db2.open_link AS link
        JOIN db1.chat_rooms AS room
          ON room.link_id = link.id
        WHERE room.id = ?
        LIMIT 1
      `,
      [channelId]
    );
    const row = rows[0];
    if (row === undefined) return null;

    return {
      name: String(row.room_name ?? ''),
      url: String(row.invite_url ?? ''),
      imageUrl: String(row.cover_url ?? ''),
      active: Number(row.is_active) === 1,
      expired: Number(row.is_expired) === 1,
      createdAt: Number(row.opened_at),
      description: String(row.room_description ?? '')
    };
  }

  /** 현재 참여 여부와 관계없이 저장된 오픈채팅 유저가 속한 방 문맥을 찾는다. */
  async getOpenUserChannelId(userId: string): Promise<string | null> {
    const rows = await this.grpc.rawQuery(
      `
        WITH matching_rooms AS (
          SELECT room.id AS id
          FROM db2.open_chat_member AS member
          JOIN db1.chat_rooms AS room
            ON room.link_id = member.link_id
           AND (
             room.id = member.involved_chat_id
             OR NOT EXISTS (
               SELECT 1 FROM db1.chat_rooms AS involved
               WHERE involved.id = member.involved_chat_id
                 AND involved.link_id = member.link_id
                 AND involved.type IN ('OD', 'OM', 'COM')
             )
           )
          WHERE member.user_id = ?
            AND room.type IN ('OD', 'OM', 'COM')
          UNION
          SELECT room.id AS id
          FROM db2.open_profile AS profile
          JOIN db1.chat_rooms AS room ON room.link_id = profile.link_id
          WHERE profile.user_id = ?
            AND room.type IN ('OD', 'OM', 'COM')
        )
        SELECT CAST(id AS TEXT) AS channel_id FROM matching_rooms
        WHERE id > 0
        ORDER BY id ASC
        LIMIT 1
      `,
      [userId, userId],
      1
    );
    const row = rows[0];
    if (row === undefined) return null;
    const id = String(row.channel_id ?? '');
    if (!isLongId(id)) {
      throw new Error('저장된 오픈채팅방 ID가 올바르지 않습니다.');
    }
    return id;
  }

  /** 오픈프로필 원본 목록을 조회한다. */
  async getOpenProfiles(): Promise<OpenProfileRow[]> {
    const rows = await this.grpc.rawQuery(
      `
        SELECT member.enc AS encryption_version,
               member.original_profile_image_url AS raw_image,
               member.nickname AS raw_name,
               member.user_id AS member_id,
               member.involved_chat_id AS room_id
        FROM db2.open_chat_member AS member
        WHERE member.involved_chat_id IS NOT NULL
      `,
      [],
      10000
    );

    return rows.map((row) => ({
      channelId: String(row.room_id),
      userId: String(row.member_id),
      rawName: row.raw_name,
      rawImage: row.raw_image,
      enc: Number(row.encryption_version)
    }));
  }

  /** 오픈프로필 원본 정보를 복호화한다. */
  async readOpenProfile(profile: OpenProfileRow) {
    const [name, profileImageUrl] = await Promise.all([
      this.grpc.decrypt(String(profile.rawName ?? ''), profile.enc),
      this.grpc.decrypt(String(profile.rawImage ?? ''), profile.enc)
    ]);

    return {
      id: profile.userId,
      name,
      profileImageUrl: profileImageUrl || null
    };
  }
}
