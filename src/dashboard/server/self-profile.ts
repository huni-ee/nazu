/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type Database from 'better-sqlite3';
import { getSelfProfile } from '../../api/auth.js';
import { isLongId } from '../../utils/id/index.js';
import type { DashboardClient } from './types.js';
import { isSafeId, isSafeName, profileImageUrl } from './validation.js';

interface StoredSelfProfile {
  readonly id?: string;
  readonly name: string;
  readonly profileImageUrl: string | null;
  readonly statusMessage: string | null;
}

/** DB에 저장한 내 메인 프로필을 화면에 보낼 형태로 읽는다. */
export function readSelfProfile(userId: string | null, database: Database.Database): StoredSelfProfile | null {
  if (userId === null) return null;
  const user = getSelfProfile(userId, database);
  if (user === null || !isSafeName(user.nickname)) return null;
  return {
    ...(isSafeId(user.userId) ? { id: user.userId } : {}),
    name: user.nickname,
    profileImageUrl: profileImageUrl(user.originalProfileImageUrl),
    statusMessage:
      typeof user.statusMessage === 'string' && user.statusMessage.length <= 2048 ? user.statusMessage : null
  };
}

/** 해당 방에서 사용하는 내 프로필을 조회한다. */
export async function readDashboardRoomSelfProfile(
  client: DashboardClient,
  channelId: string,
  accountId: string | null
) {
  if (accountId === null || !isLongId(accountId)) return null;
  try {
    const rooms = await client.query(`SELECT type FROM db1.chat_rooms WHERE id = ? LIMIT 1`, [channelId], 1);
    const roomType = rooms[0]?.type;
    if (typeof roomType !== 'string') return null;

    if (['MemoChat', 'DirectChat', 'MultiChat', 'TeamMultiChat', 'PlusChat'].includes(roomType)) {
      const profile = getSelfProfile(accountId, client.getDatabase());
      if (profile === null) return null;
      return {
        name: typeof profile.nickname === 'string' && profile.nickname.trim() ? profile.nickname : null,
        image:
          typeof profile.originalProfileImageUrl === 'string' && profile.originalProfileImageUrl.trim()
            ? profile.originalProfileImageUrl
            : null
      };
    }
    if (!['OD', 'OM', 'COM'].includes(roomType)) return null;

    const rows = await client.query(
      `SELECT profile.nickname AS name,
              COALESCE(NULLIF(profile.profile_image_url, ''), NULLIF(profile.f_profile_image_url, ''),
                       NULLIF(profile.o_profile_image_url, '')) AS image
       FROM db1.chat_rooms AS room
       JOIN db2.open_profile AS profile ON profile.link_id = room.link_id AND profile.user_id = ?
       WHERE room.id = ? AND room.type IN ('OD', 'OM', 'COM')
       LIMIT 1`,
      [accountId, channelId],
      1
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      name: typeof row.name === 'string' && row.name.trim() ? row.name : null,
      image: typeof row.image === 'string' && row.image.trim() ? row.image : null
    };
  } catch {
    return null;
  }
}

/** 확인되지 않은 내 서버 이름이 봇 설정과 같을 때는 설정값 대신 중립적인 이름을 사용한다. */
export function dashboardSelfName(name: string | null, botName: string | null): string | null {
  return botName && name?.trim() === botName.trim() ? '나' : name;
}
