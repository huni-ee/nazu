/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { api } from '../utils/api.js';
import { normalizeId, normalizeSelfProfile, normalizeFriend, compareFriends } from './data.js';
import type { Friend, SelfProfile, FriendsPayload } from './types.js';
import { errorMessageOf, errorField } from './errors.js';
import { state } from './state.js';
import { renderList } from './list.js';
import { renderDetail } from './detail.js';
import { render } from './render.js';

export function updatedFriendEntries(friendsById: Map<string, Friend>) {
  const seen = new Set();
  return state.updatedProfiles
    .flatMap((entry) => {
      const id = normalizeId(entry?.userId);
      const friend = friendsById.get(id);
      if (!friend || seen.has(id)) return [];
      seen.add(id);
      return [{ ...friend, updatedAt: entry.updatedAt }];
    })
    .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0) || compareFriends(left, right));
}

export function birthdayFriendEntries(friendsById: Map<string, Friend>, today = new Date()) {
  const entries = [];
  const seen = new Set();
  for (let offset = -2; offset < 8; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const key = `${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const birthdayEntries = state.birthdayDetails[key];
    if (!Array.isArray(birthdayEntries)) continue;
    for (const entry of birthdayEntries) {
      const id = normalizeId(typeof entry === 'object' && entry !== null && 'user_id' in entry ? entry.user_id : entry);
      const friend = friendsById.get(id);
      if (!friend || seen.has(id)) continue;
      seen.add(id);
      entries.push({ ...friend, birthdayLabel: offset === 0 ? '오늘 생일' : `${month}월 ${day}일 생일` });
    }
  }
  return entries;
}

export async function loadMe() {
  if (state.meLoading) {
    state.meReloadPending = true;
    return;
  }
  state.meLoading = true;
  state.meError = '';
  render();
  try {
    const result = await api<SelfProfile>('/me/profile');
    state.me = normalizeSelfProfile(result);
    state.meLoaded = true;
  } catch (error) {
    state.meError = errorMessageOf(error);
  } finally {
    state.meLoading = false;
    render();
    if (state.meReloadPending) {
      state.meReloadPending = false;
      if (state.connection === 'connected') void loadMe();
    }
  }
}

export async function loadSelfProfile() {
  if (state.selfProfileLoading) return;
  let retryAfterReconnect = false;
  state.selfProfileLoading = true;
  state.selfProfileError = '';
  state.selfProfile = null;
  state.selfPosts.clear();
  if (state.tab === 'friends' && state.selectedSelf) renderDetail();
  try {
    const result = await api<SelfProfile>('/me/profile');
    state.me = normalizeSelfProfile(result);
    state.meLoaded = true;
    state.selfProfile = result;
    if (state.tab === 'friends') renderList();
  } catch (error) {
    state.selfProfileError = errorMessageOf(error);
    retryAfterReconnect = errorField(error, 'code') === 'ARISA_DISCONNECTED' && state.connection === 'connected';
  } finally {
    state.selfProfileLoading = false;
    if (state.tab === 'friends' && state.selectedSelf) renderDetail();
    if (retryAfterReconnect && state.connection === 'connected' && state.selectedSelf) void loadSelfProfile();
  }
}

export async function loadFriends() {
  if (state.friendsLoading) {
    state.friendListReloadPending = true;
    return;
  }
  state.friendsLoading = true;
  state.friendsError = '';
  render();
  try {
    const result = await api<FriendsPayload>('/friends');
    applyFriendsResult(result);
  } catch (error) {
    state.friendsError = errorMessageOf(error);
  } finally {
    state.friendsLoading = false;
    render();
    if (state.friendListReloadPending) {
      state.friendListReloadPending = false;
      void loadFriends();
    }
  }
}

function applyFriendsResult(result: FriendsPayload) {
  if (!Array.isArray(result.sync?.friends)) {
    throw new Error('친구 목록 형식이 올바르지 않습니다.');
  }
  state.friends = result.sync.friends
    .filter((entry) => entry?.userType !== 1 && entry?.purged !== true && entry?.isPurged !== true)
    .map((entry, index) => normalizeFriend(entry, index))
    .sort(compareFriends);
  state.friendCreatedAt = result.createdAt?.createdAt ?? {};
  state.friendsVersion += 1;
  state.friendProfiles.clear();
  state.friendMemos.clear();
  state.friendMemoErrors.clear();
  state.friendMemosLoading.clear();
  state.friendPosts.clear();
  state.friendProfileErrors.clear();
  state.friendProfilesLoading.clear();
  state.updatedProfiles = Array.isArray(result.updated?.users) ? result.updated.users : [];
  state.birthdayDetails = result.birthday?.birthday_friends?.month_day_to_birthday_details ?? {};
  state.friendsLoaded = true;
  if (state.selectedFriendKey && !currentFriend()) {
    state.selectedFriendKey = null;
    if (state.tab === 'friends') state.mobileSelection = false;
  }
  if (state.tab === 'friends') {
    const selected = state.friends.find((friend) => friend.key === state.selectedFriendKey);
    void loadFriendProfile(selected);
    void loadFriendMemo(selected);
  }
}

export async function loadFriendProfile(friend: Friend | undefined, force = false) {
  if (!friend || state.friendProfilesLoading.has(friend.id) || (!force && state.friendProfiles.has(friend.id))) return;
  if (force) {
    for (const key of state.friendPosts.keys()) {
      if (key.startsWith(`${friend.id}:`)) state.friendPosts.delete(key);
    }
  }
  const version = state.friendsVersion;
  state.friendProfilesLoading.add(friend.id);
  state.friendProfileErrors.delete(friend.id);
  if (state.tab === 'friends') renderDetail();
  try {
    const result = await api<{ profile?: { userId?: unknown } }>(`/friends/${encodeURIComponent(friend.id)}/profile`);
    if (normalizeId(result.profile?.userId) !== friend.id) throw new Error('친구 프로필 형식이 올바르지 않습니다.');
    if (version === state.friendsVersion) {
      state.friendProfiles.set(friend.id, result.profile);
    }
  } catch (error) {
    if (version === state.friendsVersion) state.friendProfileErrors.set(friend.id, errorMessageOf(error));
  } finally {
    if (version === state.friendsVersion) {
      state.friendProfilesLoading.delete(friend.id);
      if (state.tab === 'friends') renderDetail();
    }
  }
}

export async function loadFriendMemo(friend: Friend | undefined, force = false) {
  if (!friend || state.friendMemosLoading.has(friend.id) || (!force && state.friendMemos.has(friend.id))) return;
  const version = state.friendsVersion;
  state.friendMemosLoading.add(friend.id);
  state.friendMemoErrors.delete(friend.id);
  if (state.tab === 'friends') renderDetail();
  try {
    const result = await api<{ memo?: unknown }>(`/friends/${encodeURIComponent(friend.id)}/memo`);
    if (version === state.friendsVersion) {
      state.friendMemos.set(friend.id, result.memo);
    }
  } catch (error) {
    if (version === state.friendsVersion) {
      state.friendMemoErrors.set(friend.id, errorMessageOf(error));
    }
  } finally {
    if (version === state.friendsVersion) {
      state.friendMemosLoading.delete(friend.id);
      if (state.tab === 'friends') renderDetail();
    }
  }
}

export function currentFriend() {
  return state.friends.find((friend) => friend.key === state.selectedFriendKey);
}
