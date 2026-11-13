/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

const storageKey = 'arisa.dashboard.session';
const historyKey = 'arisaDashboardSession';
const connectionKey = 'arisa-dashboard-connection';
const tabs = ['home', 'friends', 'chat', 'openchat', 'settings', 'roles'];
type DashboardSession = { connectionId: string; tab: string; roleView: 'ban' | 'admin' };
type StoredSession = Partial<DashboardSession> & { revision?: number };
let sessionRevision = 0;

function rememberedConnection() {
  try {
    return globalThis.localStorage.getItem(connectionKey) || '';
  } catch {
    return '';
  }
}

function rememberConnection(id: string) {
  if (!id) return;
  try {
    globalThis.localStorage.setItem(connectionKey, id);
  } catch {
    // 영구 저장이 차단돼도 현재 탭의 계정 전환은 계속 사용할 수 있다.
  }
}

function savedRevision(value: StoredSession | null | undefined) {
  const revision = value?.revision;
  return typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function normalizeSession(value: StoredSession | null | undefined) {
  const data = value && typeof value === 'object' ? value : {};
  return {
    connectionId: typeof data.connectionId === 'string' ? data.connectionId : '',
    tab: typeof data.tab === 'string' && tabs.includes(data.tab) ? data.tab : 'home',
    roleView: data.roleView === 'ban' ? ('ban' as const) : ('admin' as const)
  };
}

function browserHistory() {
  return globalThis.window?.history ?? globalThis.history;
}

function saveSession(session: DashboardSession) {
  const data = { ...session, revision: ++sessionRevision };
  let saved = false;
  try {
    globalThis.sessionStorage.setItem(storageKey, JSON.stringify(data));
    saved = true;
  } catch {
    // 저장소를 사용할 수 없는 브라우저에서는 현재 탭의 history state를 사용한다.
  }
  try {
    const history = browserHistory();
    if (history) {
      history.replaceState({ ...history.state, [historyKey]: data }, '');
      saved = true;
    }
  } catch {
    // 두 저장 방법이 모두 차단되면 계정 전환을 진행하지 않는다.
  }
  return saved;
}

function restoreSession() {
  let saved: StoredSession | null = null;
  try {
    saved = JSON.parse(globalThis.sessionStorage.getItem(storageKey) ?? 'null') as StoredSession | null;
  } catch {
    // 첫 방문과 저장소가 차단된 경우에는 기본 메뉴로 시작한다.
  }
  try {
    const state: unknown = browserHistory()?.state;
    const historySession =
      state && typeof state === 'object' ? (state as Record<string, StoredSession>)[historyKey] : undefined;
    if (historySession && (!saved || savedRevision(historySession) >= savedRevision(saved))) {
      saved = historySession;
    }
  } catch {
    // history state를 읽을 수 없으면 sessionStorage의 값을 사용한다.
  }
  sessionRevision = savedRevision(saved);
  const session = normalizeSession(saved);

  if (typeof location !== 'undefined') {
    const url = new URL(location.href);
    const query = url.searchParams;
    const legacyKeys = ['connection', 'view', 'settings', 'role'];
    if (legacyKeys.some((key) => query.has(key))) {
      // 이전 버전의 URL을 한 번만 읽고, 주소에서는 대시보드 상태를 제거한다.
      if (query.has('connection')) session.connectionId = query.get('connection') || '';
      const view = query.get('view');
      if (view && tabs.includes(view)) session.tab = view;
      if (query.has('role')) session.roleView = query.get('role') === 'ban' ? 'ban' : 'admin';
      for (const key of legacyKeys) query.delete(key);
      saveSession(session);
      try {
        const history = browserHistory();
        history?.replaceState(history.state, '', url.href);
      } catch {
        // 주소를 정리할 수 없는 환경에서도 저장된 계정으로 대시보드를 실행한다.
      }
    }
  }

  const lastConnection = rememberedConnection();
  if (!session.connectionId && lastConnection) {
    // 새 탭의 초기 계정만 복원하고, 이후에는 탭마다 선택을 유지한다.
    session.connectionId = lastConnection;
    saveSession(session);
  } else if (session.connectionId && !lastConnection) {
    // 기존 탭을 마이그레이션하되 다른 탭에서 선택한 마지막 계정을 덮어쓰지 않는다.
    rememberConnection(session.connectionId);
  }
  return session;
}

// 문서마다 계정을 고정해 전환 직전의 요청도 이전 계정으로 전송한다.
const currentSession = restoreSession();

export function getActiveConnectionId() {
  return currentSession.connectionId;
}

export function setActiveConnectionId(id: string) {
  currentSession.connectionId = typeof id === 'string' ? id : '';
  saveSession(currentSession);
  rememberConnection(currentSession.connectionId);
}

export function getDashboardView() {
  const { tab, roleView } = currentSession;
  return { tab, roleView };
}

export function prepareConnectionSwitch(id: string, view: Partial<DashboardSession>) {
  const session = normalizeSession({ ...view, connectionId: id });
  if (!saveSession(session)) return false;
  rememberConnection(session.connectionId);
  return true;
}
