/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { ui } from './ui.js';
import { state } from './state.js';
import { closeDialog } from './views.js';
import { loadMembers, isOpenChannel, selectedOpenGroup, currentChannel } from './channels.js';
import { loadRoles } from './roles.js';
import { loadMe, loadSelfProfile, loadFriends, loadFriendProfile, loadFriendMemo, currentFriend } from './friends.js';
import { renderDetail } from './detail.js';
import { renderNav, render } from './render.js';

export function selectOpenGroup(key: string) {
  state.selectedOpenGroupKey = key;
  state.selectedChannelId = null;
  state.selectedMemberId = null;
  state.mobileSelection = true;
  ui.detail.scrollTop = 0;
  render();
}

export function selectChannel(id: string, fromOpenProfile = false) {
  if (!fromOpenProfile) state.selectedOpenGroupKey = null;
  state.selectedChannelId = id;
  state.selectedMemberId = null;
  state.memberQuery = '';
  state.mobileSelection = true;
  ui.detail.scrollTop = 0;
  render();
  if (!state.rolesLoaded && !state.rolesLoading) void loadRoles();
  if (state.connection === 'connected') void loadMembers(id);
}

export function selectFriend(key: string) {
  state.selectedSelf = false;
  state.selectedFriendKey = key;
  state.mobileSelection = true;
  ui.detail.scrollTop = 0;
  render();
  const friend = currentFriend();
  if (!state.rolesLoaded && !state.rolesLoading) void loadRoles();
  if (state.connection !== 'connected') return;
  void loadFriendProfile(friend);
  void loadFriendMemo(friend);
}

export function selectSelf() {
  state.selectedFriendKey = null;
  state.selectedSelf = true;
  state.mobileSelection = true;
  ui.detail.scrollTop = 0;
  render();
  if (!state.rolesLoaded && !state.rolesLoading) void loadRoles();
  if (state.connection === 'connected') void loadSelfProfile();
}

export function selectRoleView(kind: 'admin' | 'ban') {
  state.roleView = kind;
  state.memberQuery = '';
  state.mobileSelection = true;
  ui.detail.scrollTop = 0;
  render();
}

export function setTab(tab: string) {
  closeDialog();
  state.tab = tab;
  state.selectedMemberId = null;
  if (tab !== 'openchat') state.selectedOpenGroupKey = null;
  state.memberQuery = '';
  state.listQuery = '';
  ui.listSearch.value = '';
  state.mobileSelection = false;
  const channel = currentChannel();
  if ((tab === 'openchat' || tab === 'chat') && channel && isOpenChannel(channel) !== (tab === 'openchat')) {
    state.selectedChannelId = null;
  }
  ui.detail.scrollTop = 0;
  render();
  if (tab === 'friends' && state.connection === 'connected') {
    void loadMe();
    if (!state.friendsLoaded) void loadFriends();
  }
}

export function goBack() {
  if (state.selectedMemberId && currentChannel()) {
    state.selectedMemberId = null;
    renderDetail();
    return;
  }
  if (state.tab === 'openchat' && state.selectedChannelId && selectedOpenGroup()) {
    state.selectedChannelId = null;
    render();
    return;
  }
  state.mobileSelection = false;
  renderNav();
}
