/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { api } from '../utils/api.js';
import { fallbackName, normalizeRoleEntries } from './data.js';
import type { Member, RoleEntry, RolesPayload } from './types.js';
import { errorMessageOf } from './errors.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { renderList } from './list.js';
import { renderDetail } from './detail.js';
import { render } from './render.js';

function applyRoles(payload: RolesPayload | null) {
  if (!Array.isArray(payload?.admins) || !Array.isArray(payload?.banned)) return false;
  state.roles.admin = normalizeRoleEntries(payload.admins, state.roles.admin);
  state.roles.ban = normalizeRoleEntries(payload.banned, state.roles.ban);
  state.rolesLoaded = true;
  state.rolesError = '';
  return true;
}

export async function loadRoles() {
  if (state.rolesLoading) return;
  state.rolesLoading = true;
  state.rolesError = '';
  renderList();
  renderDetail();
  try {
    const result = await api<RolesPayload>('/roles');
    if (!applyRoles(result)) throw new Error('권한 목록 형식이 올바르지 않습니다.');
  } catch (error) {
    state.rolesError = errorMessageOf(error);
  } finally {
    state.rolesLoading = false;
    render();
  }
}

export function hasRole(kind: 'admin' | 'ban', member: Member) {
  if (state.rolesLoaded) return state.roles[kind].has(member.id);
  return kind === 'admin' ? member.admin : member.banned;
}

export function roleDisplayName(entry: RoleEntry) {
  if (entry.name) return entry.name;
  for (const members of state.members.values()) {
    const member = members.find((candidate) => candidate.id === entry.id);
    if (member) return member.name;
  }
  return fallbackName(entry.id);
}

function updateLocalRole(kind: 'admin' | 'ban', member: Member, enabled: boolean) {
  if (enabled) state.roles[kind].set(member.id, { id: member.id, name: member.name });
  else state.roles[kind].delete(member.id);
  for (const members of state.members.values()) {
    const match = members.find((candidate) => candidate.id === member.id);
    if (match) match[kind === 'admin' ? 'admin' : 'banned'] = enabled;
  }
}

export async function changeRole(member: Member, kind: 'admin' | 'ban', enabled: boolean) {
  const key = `${kind}:${member.id}`;
  if (state.pending.has(key)) return;
  const message =
    kind === 'admin'
      ? enabled
        ? '관리자 권한을 부여했습니다.'
        : '관리자 권한을 해제했습니다.'
      : enabled
        ? '밴으로 설정했습니다.'
        : '밴을 해제했습니다.';
  state.pending.add(key);
  renderDetail();
  try {
    const payload: { userId: string; enabled: boolean; name?: string } = { userId: member.id, enabled };
    if (member.name && member.name !== fallbackName(member.id)) payload.name = member.name;
    const result = await api<RolesPayload>(`/roles/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Arisa-Dashboard': '1' },
      body: JSON.stringify(payload)
    });
    updateLocalRole(kind, member, enabled);
    if (!applyRoles(result) && !state.rolesLoaded) void loadRoles();
    showToast(`${member.name} · ${message}`);
  } catch (error) {
    showToast(errorMessageOf(error), true);
  } finally {
    state.pending.delete(key);
    render();
  }
}
