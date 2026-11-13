/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { api, getActiveConnectionId, setActiveConnectionId, setArisaConnection } from '../utils/api.js';
import { prepareConnectionSwitch } from './session.js';
import { createConnectionMonitor } from '../utils/connection.js';
import { createProfileSwitcher } from '../utils/profile-switcher.js';
import { ui } from './ui.js';
import type { Self, ConnectionsPayload, ConnectionUpdate, ConnectionStatus, ConnectionState } from './types.js';
import { errorField } from './errors.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { closeDialog } from './views.js';
import { loadChannels, loadMembers } from './channels.js';
import { loadRoles } from './roles.js';
import { loadMe, loadSelfProfile, loadFriends } from './friends.js';
import { render } from './render.js';

let remoteDataPending: Promise<PromiseSettledResult<void>[]> | null = null;
let remoteReloadQueued = false;
let connectionsInitialized = false;
let switcherProfile: Self = null;

export const profileSwitcher = createProfileSwitcher({
  node: ui.profileSwitcher,
  requestConnections: loadConnections,
  getActiveId: getActiveConnectionId,
  onSelect: selectConnection,
  onConnectionAction: changeConnection
});
export const connectionMonitor = createConnectionMonitor({
  requestStatus: requestConnectionStatus,
  onChange: applyConnectionState
});

async function loadConnections() {
  const result = await api<ConnectionsPayload>('/connections', { signal: AbortSignal.timeout(5000) });
  if (!getActiveConnectionId() && typeof result.defaultConnectionId === 'string' && result.defaultConnectionId) {
    setActiveConnectionId(result.defaultConnectionId);
  }
  return result;
}

function selectConnection(id: string) {
  if (!id || id === getActiveConnectionId()) return;
  if (!prepareConnectionSwitch(id, state)) {
    showToast('계정을 전환하지 못했습니다. 브라우저의 저장 공간을 확인해 주세요.', true);
    return;
  }
  // 새 문서에서 시작해 이전 계정의 선택, 작성 내용, 진행 중인 요청을 분리한다.
  location.reload();
}

async function changeConnection(id: string, action: 'connect' | 'disconnect') {
  connectionMonitor.stop();
  applyConnectionState({ state: 'checking' });
  try {
    await profileSwitcher.refresh();
    const result = await api<ConnectionUpdate>(`/connections/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Arisa-Dashboard': '1' },
      body: '{}'
    });
    if (id === getActiveConnectionId()) {
      applyConnectionState({
        state: result.connected ? 'connected' : result.connecting ? 'checking' : 'disconnected'
      });
    }
    showToast(
      action === 'disconnect'
        ? 'Arisa 연결을 종료했습니다.'
        : result.connected
          ? 'Arisa에 연결했습니다.'
          : 'Arisa 연결을 시도합니다.'
    );
    return result;
  } finally {
    void connectionMonitor.start();
  }
}

async function requestConnectionStatus(signal: AbortSignal) {
  await profileSwitcher.refresh();
  if (signal.aborted) throw signal.reason;
  if (!getActiveConnectionId()) throw new Error('계정 목록을 불러올 수 없습니다.');
  if (!state.rolesLoaded && !state.rolesLoading) void loadRoles();
  try {
    return await api<ConnectionStatus>('/status', { signal });
  } catch (error) {
    if (errorField(error, 'code') === 'CONNECTION_NOT_FOUND') return { connected: false, target: '' };
    throw error;
  }
}

export async function initializeConnections() {
  await profileSwitcher.refresh();
  connectionsInitialized = true;
  void connectionMonitor.start();
}

export function updateSwitcherProfile() {
  if (state.me && state.me !== switcherProfile) {
    profileSwitcher.updateProfile(state.me);
    switcherProfile = state.me;
  }
}

export function onArisaDisconnected() {
  applyConnectionState({ state: 'disconnected' });
  void checkConnection();
}

function applyConnectionState(snapshot: { state: ConnectionState }) {
  const changed = state.connection !== snapshot.state;
  const wasConnected = state.connection === 'connected';
  state.connection = snapshot.state;
  const connected = state.connection === 'connected';
  setArisaConnection(connected, onArisaDisconnected);
  if (changed) {
    if (!connected) {
      closeDialog();
    }
    render();
  }
  if (connected && !wasConnected) void reloadRemoteData();
}

export async function checkConnection() {
  applyConnectionState(await connectionMonitor.refresh());
}

async function reloadRemoteData() {
  if (remoteDataPending) {
    remoteReloadQueued = true;
    return;
  }
  remoteDataPending = Promise.allSettled([loadMe(), loadFriends(), loadChannels()]);
  try {
    await remoteDataPending;
    if (state.connection !== 'connected') return;
    if (state.selectedSelf) void loadSelfProfile();
    if (state.selectedChannelId) void loadMembers(state.selectedChannelId, true);
  } finally {
    remoteDataPending = null;
    if (remoteReloadQueued) {
      remoteReloadQueued = false;
      if (state.connection === 'connected') void reloadRemoteData();
    }
  }
}

export function isConnectionsInitialized() {
  return connectionsInitialized;
}
