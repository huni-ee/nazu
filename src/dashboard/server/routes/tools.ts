/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { performance } from 'node:perf_hooks';
import { getSelfProfile } from '../../../api/auth.js';
import { UserSelf } from '../../../user/user-self.js';
import { isLongId } from '../../../utils/id/index.js';
import { HttpError, readJsonBody, requireDashboardHeader, sendJson } from '../http.js';
import { dashboardSelfName, readDashboardRoomSelfProfile } from '../self-profile.js';
import { validateHomeSql } from '../sql.js';
import type { DashboardClient, DashboardOpenUserContext, DashboardToolUser, RouteContext } from '../types.js';

interface ToolUserData {
  readonly type: 'normal' | 'open';
  readonly user: Record<string, unknown>;
}

type ToolUserResult =
  | ({ readonly userId: string; readonly ok: true } & ToolUserData)
  | { readonly userId: string; readonly ok: false; readonly error: string };

function requiredId(url: URL, key: string, label: string): string {
  const values = url.searchParams.getAll(key);
  const value = values[0];
  if (values.length !== 1 || !isLongId(value)) {
    throw new HttpError(400, `${label} ID를 올바르게 입력하세요.`);
  }
  return value;
}

function userData(user: DashboardToolUser, channelContext = true): Record<string, unknown> {
  const raw = user.raw;
  return {
    id: raw.id,
    name: raw.name,
    customName: raw.customName,
    profileImageUrl: raw.profileImageUrl,
    ...(!channelContext || raw.memberType === undefined ? {} : { memberType: raw.memberType }),
    ...(raw.profileType === undefined ? {} : { profileType: raw.profileType }),
    ...(!channelContext || raw.openChannel === undefined
      ? {}
      : {
          openChannel: {
            memberType: raw.openChannel.memberType,
            profileType: raw.openChannel.profileType,
            profileLinkId: raw.openChannel.profileLinkId
          }
        }),
    isMine: user.isMine(),
    ...(channelContext ? { isHost: user.isHost(), isModerator: user.isModerator() } : {}),
    isBot: user.isBotUser() || raw.memberType === 'bot' || raw.openChannel?.memberType === 'bot'
  };
}

function errorCode(error: unknown): unknown {
  return error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
}

async function readToolUser(client: DashboardClient, userId: string, normalOnly = false): Promise<ToolUserData> {
  try {
    if (userId === client.getAccountId()) {
      const profile = getSelfProfile(userId, client.getDatabase());
      if (profile === null) throw new HttpError(503, '내 프로필을 가져올 수 없습니다.');
      const user = new UserSelf(userId, profile.nickname, profile.originalProfileImageUrl || null);
      return { type: 'normal', user: userData(user, false) };
    }
    const user = await client.getUser(userId);
    const isOpen = user.raw.openChannel !== undefined;
    if (normalOnly && isOpen) throw new HttpError(404, '유저를 찾을 수 없습니다.');
    return { type: isOpen ? 'open' : 'normal', user: userData(user, isOpen) };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    const notFound =
      errorCode(error) === 5 ||
      errorCode(error) === 'OPEN_USER_NOT_FOUND' ||
      (error instanceof Error && error.message === '유저 정보가 없습니다.');
    throw new HttpError(
      notFound ? 404 : 503,
      notFound ? '유저를 찾을 수 없습니다.' : '유저 정보를 가져올 수 없습니다. 유저 ID와 Arisa 연결을 확인해 주세요.'
    );
  }
}

function openToolUserError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  const notFound =
    errorCode(error) === 5 ||
    errorCode(error) === 'OPEN_USER_NOT_FOUND' ||
    (error instanceof Error && error.message === '유저 정보가 없습니다.');
  return new HttpError(
    notFound ? 404 : 503,
    notFound
      ? '오픈채팅 유저를 찾을 수 없습니다.'
      : '오픈채팅 유저 정보를 가져올 수 없습니다. 유저 ID와 Arisa 연결을 확인해 주세요.'
  );
}

async function readOpenToolUser(client: DashboardClient, userId: string): Promise<Record<string, unknown>> {
  let context: DashboardOpenUserContext;
  try {
    context = await client.getOpenUser(userId);
  } catch (error) {
    throw openToolUserError(error);
  }
  try {
    const channel = context.channel;
    if (!['OD', 'OM', 'COM'].includes(channel.type)) {
      throw new HttpError(400, '오픈채팅 유저 정보를 찾을 수 없습니다.');
    }
    const user = userData(context.user);
    if (context.user.isMine()) {
      const profile = await readDashboardRoomSelfProfile(client, channel.id, client.getAccountId());
      user.name = profile?.name ?? dashboardSelfName(context.user.name, client.botName);
      user.profileImageUrl = profile?.image ?? context.user.profileImageUrl;
    }
    return {
      type: 'open',
      channel: { id: channel.id, name: channel.name, type: channel.type },
      user
    };
  } catch (error) {
    throw openToolUserError(error);
  }
}

async function runTool({ request, url, client }: RouteContext): Promise<unknown> {
  if (url.pathname === '/api/tools/health') {
    if (request.method !== 'GET') throw new HttpError(405, 'GET 요청으로 연결 상태를 확인하세요.');
    const checkedAt = new Date().toISOString();
    const startedAt = performance.now();
    try {
      await client.healthCheck();
      return {
        connected: true,
        latencyMs: Math.round((performance.now() - startedAt) * 10) / 10,
        target: client.target,
        checkedAt
      };
    } catch {
      return {
        connected: false,
        latencyMs: null,
        target: client.target,
        checkedAt,
        error: 'Arisa 서버에 연결할 수 없습니다. 서버 주소와 실행 상태를 확인해 주세요.'
      };
    }
  }
  if (url.pathname === '/api/tools/channel') {
    if (request.method !== 'GET') throw new HttpError(405, 'GET 요청으로 채팅방을 조회하세요.');
    const channelId = requiredId(url, 'channelId', '채팅방');
    try {
      const channel = await client.getChannel(channelId);
      const memberIds = await channel.memberIds;
      const members = await channel.members;
      const host = members.find((member) => member.isHost());
      const open = channel.openChannel;
      return {
        channel: {
          id: channel.id,
          type: channel.type,
          name: channel.name,
          privateName: channel.privateName ?? null,
          openChannel: open
            ? {
                name: open.name,
                url: open.url,
                imageUrl: open.imageUrl,
                active: open.active,
                expired: open.expired,
                createdAt: open.createdAt,
                description: open.description
              }
            : null,
          memberCount: memberIds.length,
          host: host ? userData(host) : null,
          moderators: members.filter((member) => member.isModerator()).map((member) => userData(member))
        }
      };
    } catch (error) {
      throw new HttpError(
        errorCode(error) === 5 ? 404 : 503,
        errorCode(error) === 5
          ? '채팅방을 찾을 수 없습니다.'
          : '채팅방 정보를 가져올 수 없습니다. 채팅방 ID와 Arisa 연결을 확인해 주세요.'
      );
    }
  }
  if (url.pathname === '/api/tools/channel/enter') {
    if (request.method !== 'POST') throw new HttpError(405, 'POST 요청으로 채팅방 열기를 요청하세요.');
    requireDashboardHeader(request);
    const body = await readJsonBody(request);
    const channelId = body.channelId;
    if (!isLongId(channelId)) {
      throw new HttpError(400, '채팅방 ID를 올바르게 입력하세요.');
    }
    try {
      const channel = await client.getChannel(channelId);
      await channel.enter();
      return { queued: true, channelId };
    } catch (error) {
      throw new HttpError(
        errorCode(error) === 5 ? 404 : 503,
        errorCode(error) === 5
          ? '채팅방을 찾을 수 없습니다.'
          : '채팅방 열기 요청의 응답을 확인하지 못했습니다. 연결된 카카오톡과 Arisa 연결을 확인하세요.'
      );
    }
  }
  if (url.pathname === '/api/tools/user') {
    if (request.method !== 'GET') throw new HttpError(405, 'GET 요청으로 유저를 조회하세요.');
    const types = url.searchParams.getAll('type');
    const type = types[0];
    if (types.length > 1 || (type !== undefined && type !== 'normal' && type !== 'open')) {
      throw new HttpError(400, '일반 유저 또는 오픈채팅 유저를 선택하세요.');
    }
    const userId = requiredId(url, 'userId', '유저');
    if (url.searchParams.has('channelId')) {
      throw new HttpError(400, '유저 조회에는 유저 ID만 입력하세요.');
    }
    if (type === 'normal') {
      return readToolUser(client, userId, true);
    }
    if (type === 'open') {
      return readOpenToolUser(client, userId);
    }
    return readToolUser(client, userId);
  }
  if (url.pathname === '/api/tools/users') {
    if (request.method !== 'POST') throw new HttpError(405, 'POST 요청으로 유저 목록을 조회하세요.');
    requireDashboardHeader(request);
    const body = await readJsonBody(request);
    const values = body.userIds;
    if (!Array.isArray(values) || values.length < 1) {
      throw new HttpError(400, '유저 ID 목록은 비어 있지 않은 문자열 배열로 입력하세요.');
    }
    const userIds: string[] = [];
    for (const value of values) {
      if (!isLongId(value)) {
        throw new HttpError(400, '유저 ID는 양의 64비트 정수 문자열로 입력하세요.');
      }
      userIds.push(value);
    }
    const ids = [...new Set(userIds)];
    const results: ToolUserResult[] = [];
    for (let offset = 0; offset < ids.length; offset += 8) {
      const batchIds = ids.slice(offset, offset + 8);
      const batch = await Promise.allSettled(batchIds.map((userId) => readToolUser(client, userId)));
      for (const [index, userId] of batchIds.entries()) {
        const result = batch[index];
        if (result?.status === 'fulfilled') {
          results.push({ userId, ok: true, ...result.value });
        } else {
          const error: unknown = result?.reason;
          results.push({
            userId,
            ok: false,
            error: error instanceof HttpError ? error.message : '유저 정보를 가져올 수 없습니다.'
          });
        }
      }
    }
    const successCount = results.filter((result) => result.ok).length;
    return { results, count: results.length, successCount, failureCount: results.length - successCount };
  }
  if (url.pathname === '/api/tools/messages') {
    if (request.method !== 'POST') throw new HttpError(405, 'POST 요청으로 메세지를 조회하세요.');
    requireDashboardHeader(request);
    const body = await readJsonBody(request);
    const channelId = body.channelId;
    if (!isLongId(channelId)) {
      throw new HttpError(400, '채팅방 ID를 올바르게 입력하세요.');
    }
    const values = body.messageIds;
    if (!Array.isArray(values) || values.length < 1) {
      throw new HttpError(400, '메세지 ID 목록은 비어 있지 않은 문자열 배열로 입력하세요.');
    }
    const messageIds: string[] = [];
    for (const value of values) {
      if (!isLongId(value)) {
        throw new HttpError(400, '메세지 ID는 양의 64비트 정수 문자열로 입력하세요.');
      }
      messageIds.push(value);
    }
    const ids = [...new Set(messageIds)];
    try {
      const channel = await client.getChannel(channelId);
      const messages = ids.length === 1 ? [await channel.getChat(ids[0]!)] : await channel.getChats(ids);
      return { channelId, messages: messages.map((message) => message.raw) };
    } catch (error) {
      const notFound =
        errorCode(error) === 5 || (error instanceof Error && error.message === '메세지 정보가 없습니다.');
      throw new HttpError(
        notFound ? 404 : 503,
        notFound
          ? '채팅방 또는 메세지를 찾을 수 없습니다.'
          : '메세지를 가져올 수 없습니다. 채팅방 ID, 메세지 ID와 Arisa 연결을 확인해 주세요.'
      );
    }
  }
  if (url.pathname === '/api/tools/decrypt') {
    if (request.method !== 'POST') throw new HttpError(405, 'POST 요청으로 복호화를 요청하세요.');
    requireDashboardHeader(request);
    const body = await readJsonBody(request);
    const { ciphertext, enc, userId } = body;
    if (typeof ciphertext !== 'string' || !ciphertext.trim()) {
      throw new HttpError(400, '복호화할 암호문을 입력하세요.');
    }
    if (typeof enc !== 'number' || !Number.isInteger(enc) || enc < 0 || enc > 4294967295) {
      throw new HttpError(400, 'enc는 0~4294967295의 정수로 입력하세요.');
    }
    if (userId !== undefined && !isLongId(userId)) {
      throw new HttpError(400, '유저 ID를 올바르게 입력하세요.');
    }
    try {
      return { plaintext: await client.decrypt(ciphertext, enc, userId) };
    } catch (error) {
      const code = errorCode(error);
      const invalid = code === 3 || code === 5 || code === 13;
      throw new HttpError(
        invalid ? 422 : 503,
        invalid
          ? '복호화하지 못했습니다. 암호문, enc와 유저 ID를 확인해 주세요.'
          : '복호화 요청에 실패했습니다. Arisa 연결을 확인하고 다시 시도해 주세요.'
      );
    }
  }
  if (url.pathname === '/api/tools/query') {
    if (request.method !== 'POST') throw new HttpError(405, 'POST 요청으로 SQL을 조회하세요.');
    requireDashboardHeader(request);
    const body = await readJsonBody(request);
    const sql = validateHomeSql(body.sql);
    const params: unknown = body.params === undefined ? [] : body.params;
    if (
      !Array.isArray(params) ||
      params.length > 100 ||
      !params.every(
        (value: unknown) =>
          value === null ||
          typeof value === 'string' ||
          typeof value === 'boolean' ||
          (typeof value === 'number' &&
            Number.isFinite(value) &&
            (!Number.isInteger(value) || Number.isSafeInteger(value)))
      )
    ) {
      throw new HttpError(
        400,
        '매개변수는 문자열·숫자·불리언·null의 배열로 입력하세요. 큰 정수 ID는 문자열을 사용하세요.'
      );
    }
    const limit = body.limit;
    if (
      limit !== undefined &&
      (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 4294967295)
    ) {
      throw new HttpError(400, '최대 행 수는 1부터 4294967295까지의 정수로 입력해 주세요.');
    }
    let rows;
    try {
      rows = await client.query(sql, params as (string | number | boolean | null)[], limit);
    } catch (error) {
      const invalid = errorCode(error) === 3 || errorCode(error) === 13;
      throw new HttpError(
        invalid ? 422 : 503,
        invalid
          ? 'SQL을 실행하지 못했습니다. 구문, 테이블과 열 이름, 매개변수를 확인해 주세요.'
          : 'SQL 조회에 실패했습니다. Arisa 연결을 확인하고 다시 시도해 주세요.'
      );
    }
    return { rows, count: rows.length, limit };
  }
  throw new HttpError(404, '조회 도구를 찾을 수 없습니다.');
}

/** 홈 화면의 조회·전송 도구. 오류 응답에는 Arisa의 원래 오류 내용을 넣지 않는다. */
export async function handleToolRoute(context: RouteContext): Promise<boolean> {
  if (!context.url.pathname.startsWith('/api/tools/')) return false;
  sendJson(context.response, 200, await runTool(context));
  return true;
}
