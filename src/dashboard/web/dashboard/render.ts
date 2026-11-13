/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { CHANNEL_TYPE_LABELS } from '../constants/chat.js';
import { requireElement, ui } from './ui.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { updateSwitcherProfile } from './connections.js';
import {
  loadMembers,
  isOpenChannel,
  openGroupKey,
  ownGroupRooms,
  selectedOpenGroup,
  visibleOpenGroups,
  visibleChannels,
  currentChannel,
  enterRoom
} from './channels.js';
import { loadRoles, hasRole, roleDisplayName, changeRole } from './roles.js';
import { renderList } from './list.js';
import { renderDetail } from './detail.js';
import { selectOpenGroup, selectChannel, selectRoleView, goBack } from './navigation.js';

export function roomSnapshot() {
  return {
    state,
    helpers: {
      visibleChannels,
      visibleOpenGroups,
      openGroupKey,
      ownGroupRooms,
      isOpenChannel,
      channelTypeLabels: CHANNEL_TYPE_LABELS,
      currentChannel,
      selectedOpenGroup,
      hasRole,
      roleDisplayName
    },
    actions: {
      selectRoleView,
      selectOpenGroup,
      selectChannel,
      changeRole,
      enterRoom,
      loadMembers,
      loadRoles,
      showToast,
      goBack,
      selectMember(id: string) {
        state.selectedMemberId = id;
        ui.detail.scrollTop = 0;
        renderDetail();
      },
      setMemberQuery(value: string) {
        state.memberQuery = value;
        renderDetail();
      }
    }
  };
}

export function renderNav() {
  for (const tab of ['home', 'friends', 'chat', 'openchat', 'settings']) {
    const node = requireElement(`nav-${tab}`);
    node.classList.toggle('is-active', state.tab === tab);
    node.setAttribute('aria-current', state.tab === tab ? 'page' : 'false');
  }
  ui.shell.classList.toggle('has-selection', state.mobileSelection);
  ui.shell.classList.toggle('is-home', state.tab === 'home');
  ui.shell.classList.toggle('is-friends', state.tab === 'friends');
  ui.shell.classList.toggle('is-settings', state.tab === 'settings');
}

export function render() {
  updateSwitcherProfile();
  renderNav();
  renderList();
  renderDetail();
}
