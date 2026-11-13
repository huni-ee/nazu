/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { getActiveConnectionId } from '../dashboard/session.js';

export { getActiveConnectionId, setActiveConnectionId } from '../dashboard/session.js';

class DashboardApiError extends Error {
  code?: string;
  status?: number;
}

let arisaConnected = true;
let connectionRevision = 0;
let onDisconnected: (() => void) | undefined;

export function setArisaConnection(connected: boolean, listener?: () => void) {
  if (arisaConnected !== connected) connectionRevision += 1;
  arisaConnected = connected;
  onDisconnected = listener;
}

function disconnectedError() {
  const error = new DashboardApiError('Arisa 서버에 연결될 때까지 기다려 주세요.');
  error.code = 'ARISA_DISCONNECTED';
  return error;
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const requiresArisa =
    /^\/(friends|channels|me\/(profile|posts)|tools\/(channel|user|users|messages|decrypt|query))(\/|\?|$)/.test(path);
  const isRead =
    ['GET', 'HEAD'].includes((options.method ?? 'GET').toUpperCase()) ||
    /^\/tools\/(query|users|messages|decrypt)(?:\?|$)/.test(path);
  if (requiresArisa && !arisaConnected) throw disconnectedError();
  const revision = connectionRevision;
  const { headers = {}, ...requestOptions } = options;
  const connectionId = getActiveConnectionId();
  const response = await fetch(`/api${path}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...requestOptions,
    headers: {
      Accept: 'application/json',
      ...headers,
      ...(connectionId ? { 'X-Arisa-Connection': connectionId } : {})
    }
  });
  const body: unknown = await response.json().catch(() => ({}));
  if (/^\/(tools|channels)\//.test(path) && connectionId !== getActiveConnectionId()) {
    const error = new DashboardApiError(
      isRead
        ? '선택한 계정이 변경되었습니다. 다시 조회해 주세요.'
        : '선택한 계정이 변경되어 요청 응답을 확인하지 못했습니다. 기존 계정의 카카오톡을 확인해 주세요.'
    );
    error.code = 'CONNECTION_CHANGED';
    throw error;
  }
  if (requiresArisa && isRead && revision !== connectionRevision) throw disconnectedError();
  if (!response.ok) {
    const errorBody = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const message =
      typeof errorBody.error === 'string'
        ? errorBody.error
        : typeof errorBody.message === 'string'
          ? errorBody.message
          : `요청에 실패했습니다 (${response.status}).`;
    const error = new DashboardApiError(message);
    error.status = response.status;
    if (typeof errorBody.code === 'string') error.code = errorBody.code;
    if (error.code === 'ARISA_DISCONNECTED') {
      setArisaConnection(false, onDisconnected);
      onDisconnected?.();
    }
    throw error;
  }
  return body as T;
}
