/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type Database from 'better-sqlite3';
import { getDatabase, initDatabase } from '../utils/database/index.js';
import type { Credential, KakaoAuthData, SelfProfileDetail } from './types.js';
import type { SelfProfile } from '../types/user.js';
import { initSelfProfile } from './self-profile.js';

const profiles = new WeakMap<Database.Database, Map<string, SelfProfile>>();

/** 인증 정보로 메인 프로필을 초기화한다. */
export async function initAuth(credential: Credential): Promise<KakaoAuthData> {
  return saveAuthProfile(credential, await initSelfProfile(credential));
}

/** 조회한 메인 프로필을 인증 정보와 함께 DB와 메모리에 저장한다. */
export function saveAuthProfile(
  credential: Credential,
  detail: SelfProfileDetail,
  database: Database.Database = getDatabase() ?? initDatabase()
): KakaoAuthData {
  const data: KakaoAuthData = {
    accessToken: credential.accessToken,
    refreshToken: credential.refreshToken,
    deviceUuid: credential.deviceUuid,
    revision: detail.revision,
    raw: {
      user: {
        userId: String(detail.profile.userId),
        nickname: detail.main.nickname,
        statusMessage: detail.main.statusMessage,
        originalProfileImageUrl: detail.main.originalProfileImageUrl,
        main: true
      }
    },
    status: detail.profile.status
  };
  saveAuth(data, database);
  cacheProfile(data.raw.user, database);
  return data;
}

/** 계정 ID로 저장한 인증 정보와 프로필을 읽는다. */
function readAuth(userId: string, database: Database.Database | null = getDatabase()): KakaoAuthData | null {
  if (database === null) return null;
  const row = database
    .prepare<[string], { readonly data: string }>('SELECT data FROM account WHERE user_id = ?')
    .get(userId);
  if (row === undefined) return null;
  try {
    const data = JSON.parse(row.data) as KakaoAuthData;
    return {
      ...data,
      raw: { ...data.raw, user: { ...data.raw.user, userId } }
    };
  } catch {
    return null;
  }
}

/** 계정 ID로 내 프로필을 가져온다. */
export function getSelfProfile(userId: string, database: Database.Database | null = getDatabase()): SelfProfile | null {
  if (database === null) return null;
  const cached = profiles.get(database)?.get(userId);
  if (cached !== undefined) return cached;
  const profile = readAuth(userId, database)?.raw.user ?? null;
  if (profile !== null) cacheProfile(profile, database);
  return profile;
}

function saveAuth(data: KakaoAuthData, database: Database.Database): void {
  database
    .prepare<[string, string]>(
      `INSERT INTO account (user_id, data) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET data = excluded.data`
    )
    .run(data.raw.user.userId, JSON.stringify(data));
}

function cacheProfile(profile: SelfProfile, database: Database.Database): void {
  let cache = profiles.get(database);
  if (cache === undefined) {
    cache = new Map();
    profiles.set(database, cache);
  }
  cache.set(profile.userId, profile);
}
