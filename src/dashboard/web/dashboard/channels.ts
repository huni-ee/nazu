/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { OPEN_CHANNEL_TYPES } from '../constants/chat.js';
import { api } from '../utils/api.js';
import {
  normalizeId,
  normalizeChannel,
  normalizeMember,
  compareMembers,
  compareRoomNames,
  compareChannels,
  compareOpenGroups
} from './data.js';
import type { Channel, Member, OpenGroup, RawMember, ChannelPayload } from './types.js';
import { errorMessageOf, errorField } from './errors.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { renderList } from './list.js';
import { renderDetail } from './detail.js';
import { render } from './render.js';

export async function loadChannels() {
  if (state.channelsLoading) {
    state.channelsReloadPending = true;
    return;
  }
  state.channelsLoading = true;
  state.channelsError = '';
  renderList();
  try {
    const result = await api<ChannelPayload>('/channels');
    if (!Array.isArray(result.channels)) throw new Error('채팅방 목록 형식이 올바르지 않습니다.');
    state.channels = result.channels.map(normalizeChannel).filter((channel): channel is Channel => channel !== null);
    const profiles = Array.isArray(result.ownOpenProfiles) ? result.ownOpenProfiles : [];
    const directChats = Array.isArray(result.ownDirectOpenChats) ? result.ownDirectOpenChats : [];
    state.ownOpenGroups = [
      ...profiles.map((entry) => ({ ...entry, groupKind: 'profile' as const })),
      ...directChats.map((entry) => ({ ...entry, profileImageUrl: entry.imageUrl, groupKind: 'direct' as const }))
    ].filter((entry) => normalizeId(entry.id));
    if (state.selectedOpenGroupKey && !selectedOpenGroup()) {
      state.selectedOpenGroupKey = null;
    }
    state.channelsLoaded = true;
    if (state.selectedChannelId && !state.channels.some((channel) => channel.id === state.selectedChannelId)) {
      state.selectedChannelId = null;
      state.selectedMemberId = null;
      state.mobileSelection = false;
    }
  } catch (error) {
    state.channelsError = errorMessageOf(error);
  } finally {
    state.channelsLoading = false;
    render();
    if (state.channelsReloadPending) {
      state.channelsReloadPending = false;
      if (state.connection === 'connected') void loadChannels();
    }
  }
}

export async function loadMembers(channelId: string, force = false) {
  if (!force && state.members.has(channelId)) return;
  if (state.membersLoading.has(channelId)) {
    if (force) state.membersReloadPending.add(channelId);
    return;
  }
  let retryAfterReconnect = false;
  const hadMembers = state.members.has(channelId);
  const hadError = state.memberErrors.has(channelId);
  let shouldRender = !hadMembers || hadError;
  state.membersLoading.add(channelId);
  state.memberErrors.delete(channelId);
  if (shouldRender || state.selectedChannelId === channelId) renderDetail();
  try {
    const result = await api<{ members?: RawMember[] }>(`/channels/${encodeURIComponent(channelId)}/members`, {
      signal: AbortSignal.timeout(15000)
    });
    if (!Array.isArray(result.members)) throw new Error('멤버 목록 형식이 올바르지 않습니다.');
    const members = result.members
      .map(normalizeMember)
      .filter((member): member is Member => member !== null)
      .sort(compareMembers);
    if (JSON.stringify(state.members.get(channelId)) !== JSON.stringify(members)) {
      state.members.set(channelId, members);
      shouldRender = true;
    }
  } catch (error) {
    if (!hadMembers) {
      state.memberErrors.set(channelId, errorMessageOf(error));
      shouldRender = true;
    }
    retryAfterReconnect = errorField(error, 'code') === 'ARISA_DISCONNECTED' && state.connection === 'connected';
  } finally {
    state.membersLoading.delete(channelId);
    if (shouldRender) render();
    else if (state.selectedChannelId === channelId) renderDetail();
    const reloadPending = state.membersReloadPending.delete(channelId);
    if (
      (retryAfterReconnect || reloadPending) &&
      state.connection === 'connected' &&
      state.selectedChannelId === channelId
    )
      void loadMembers(channelId, true);
  }
}

export function isOpenChannel(channel: Channel) {
  return OPEN_CHANNEL_TYPES.has(channel.type.toUpperCase());
}

export function openGroupKey(entry: OpenGroup) {
  return `${entry.groupKind}:${normalizeId(entry.id)}`;
}

export function ownGroupRooms(entry: OpenGroup) {
  const id = normalizeId(entry.id);
  return state.channels
    .filter(
      (channel) =>
        channel.type.toUpperCase() === 'OD' &&
        (entry.groupKind === 'profile' ? channel.ownOpenProfileId === id : channel.ownDirectOpenChatId === id)
    )
    .sort(compareRoomNames);
}

export function selectedOpenGroup() {
  return state.ownOpenGroups.find((entry) => openGroupKey(entry) === state.selectedOpenGroupKey);
}

export function visibleOpenGroups() {
  const query = state.listQuery.trim().toLocaleLowerCase();
  return state.ownOpenGroups
    .filter((entry) => {
      const id = normalizeId(entry.id);
      return (
        !query ||
        String(entry.name ?? '')
          .toLocaleLowerCase()
          .includes(query) ||
        id.includes(query) ||
        ownGroupRooms(entry).some(
          (channel) => channel.name.toLocaleLowerCase().includes(query) || channel.id.includes(query)
        )
      );
    })
    .sort(compareOpenGroups);
}

export function visibleChannels() {
  const query = state.listQuery.trim().toLocaleLowerCase();
  return state.channels
    .filter((channel) => {
      if (state.tab === 'openchat' && !isOpenChannel(channel)) return false;
      if (
        state.tab === 'openchat' &&
        channel.type.toUpperCase() === 'OD' &&
        state.ownOpenGroups.some((entry) =>
          entry.groupKind === 'profile'
            ? normalizeId(entry.id) === channel.ownOpenProfileId
            : normalizeId(entry.id) === channel.ownDirectOpenChatId
        )
      )
        return false;
      if (
        state.tab === 'chat' &&
        (isOpenChannel(channel) || ['MEMOCHAT', 'PLUSCHAT'].includes(channel.type.toUpperCase()))
      )
        return false;
      return !query || channel.name.toLocaleLowerCase().includes(query) || channel.id.includes(query);
    })
    .sort(compareChannels);
}

export function currentChannel() {
  return state.channels.find((channel) => channel.id === state.selectedChannelId);
}

export async function enterRoom(channel: Channel) {
  const key = `enter:${channel.id}`;
  if (state.pending.has(key)) return;
  state.pending.add(key);
  renderDetail();
  try {
    const result = await api<{ queued?: boolean }>('/tools/channel/enter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Arisa-Dashboard': '1' },
      body: JSON.stringify({ channelId: channel.id }),
      signal: AbortSignal.timeout(20_000)
    });
    if (result.queued !== true) {
      throw new Error('요청 응답을 확인하지 못했습니다. 연결된 카카오톡을 확인해 주세요.');
    }
    showToast(`${channel.name} 채팅방을 열었습니다.`);
  } catch (error) {
    showToast(
      errorField(error, 'name') !== 'TimeoutError' &&
        (errorField(error, 'status') !== undefined || errorField(error, 'code'))
        ? errorMessageOf(error)
        : '요청 응답을 확인하지 못했습니다. 연결된 카카오톡을 확인해 주세요.',
      true
    );
  } finally {
    state.pending.delete(key);
    if (state.selectedChannelId === channel.id && !state.selectedMemberId) renderDetail();
  }
}
