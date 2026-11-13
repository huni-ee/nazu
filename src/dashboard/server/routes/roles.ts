/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { IncomingMessage } from 'node:http';
import { HttpError, readJsonBody, requireDashboardHeader, sendJson } from '../http.js';
import { changeRole, roleList, type Role, type RoleEntry } from '../role-store.js';
import { dashboardSelfName, readSelfProfile } from '../self-profile.js';
import type { RouteContext } from '../types.js';
import { isSafeId, isSafeName } from '../validation.js';

interface RoleChange {
  readonly userId: string;
  readonly enabled: boolean;
  readonly name?: string;
}

async function readRoleChange(request: IncomingMessage): Promise<RoleChange> {
  const body = await readJsonBody(request);
  if (!isSafeId(body.userId) || typeof body.enabled !== 'boolean') {
    throw new HttpError(400, 'userId와 enabled 값이 올바르지 않습니다.');
  }
  if (body.name !== undefined && !isSafeName(body.name)) {
    throw new HttpError(400, 'name 값이 올바르지 않습니다.');
  }
  return {
    userId: body.userId,
    enabled: body.enabled,
    ...(body.name !== undefined ? { name: body.name } : {})
  };
}

/** 봇 관리자·밴 목록을 조회하고 변경한다. */
export async function handleRoleRoute({ request, response, url, client }: RouteContext): Promise<boolean> {
  const pathname = url.pathname;
  if (request.method === 'GET' && pathname === '/api/roles') {
    const database = client.getDatabase();
    const accountId = client.getAccountId();
    let selfName: string | undefined;
    try {
      selfName = readSelfProfile(accountId, database)?.name;
    } catch {
      // 내 프로필이 없어도 다른 역할 목록은 표시한다.
    }
    const roles = (role: Role): RoleEntry[] =>
      roleList(database, role).map((entry) => {
        if (accountId === null || entry.id !== accountId) return entry;
        const name = selfName ?? dashboardSelfName(entry.name ?? null, client.botName);
        return name === null ? { id: entry.id } : { id: entry.id, name };
      });
    sendJson(response, 200, { admins: roles('admin'), banned: roles('ban') });
    return true;
  }
  const roleMatch = /^\/api\/roles\/(admin|ban)$/.exec(pathname);
  if (request.method === 'POST' && roleMatch !== null) {
    requireDashboardHeader(request);
    const change = await readRoleChange(request);
    const role = roleMatch[1] === 'admin' ? 'admin' : 'ban';
    changeRole(client.getDatabase(), role, change.userId, change.enabled, change.name);
    sendJson(response, 200, { ok: true });
    return true;
  }
  return false;
}
