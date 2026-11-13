/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { api, getActiveConnectionId } from '../utils/api.js';
import { copyText } from '../utils/copy-field.js';
import { profile } from '../utils/profile.js';
import { createHomeController } from '../utils/home.js';
import { createThemeSettings } from '../utils/settings.js';
import { normalizeId, normalizeSelfProfile } from './data.js';
import { arrangeMasonryCards } from '../utils/masonry.js';
import { ui } from './ui.js';
import type { Friend } from './types.js';
import { state } from './state.js';
import { showToast } from './toast.js';
import { roomViews, friendViews, showImageViewer, showVideoViewer } from './views.js';
import { emptyState, loadingState } from './placeholders.js';
import { checkConnection } from './connections.js';
import { selectedOpenGroup, currentChannel } from './channels.js';
import { loadRoles, hasRole, changeRole } from './roles.js';
import { loadSelfProfile, loadFriends, loadFriendProfile, loadFriendMemo, currentFriend } from './friends.js';
import {
  friendPostContent,
  postOwner,
  isPostOwnerCurrent,
  isPostOwnerSelected,
  showFriendPostDetail
} from './posts.js';
import { roomSnapshot } from './render.js';

let settingsCleanup: (() => void) | null = null;
let homeController: ReturnType<typeof createHomeController> | null = null;

export function setHeader(title: string, subtitle: string, photo: unknown, iconName = 'user') {
  ui.detailTitle.textContent = title;
  ui.detailSubtitle.textContent = subtitle;
  ui.headerProfile.replaceChildren();
  ui.headerProfile.append(...profile(photo, false, iconName).childNodes);
}

function renderSvelteFriendDetail(friend: Friend | null) {
  setHeader('', '', '');
  ui.detailHeader.classList.add('is-friend-detail');
  ui.detail.classList.add('is-friend-detail');
  const bridge = {
    showImageViewer,
    showVideoViewer,
    hasRole,
    changeRole,
    loadRoles,
    loadFriendMemo,
    loadFriendProfile,
    normalizeId,
    postOwner,
    friendPostContent,
    showFriendPostDetail,
    isPostOwnerCurrent,
    isPostOwnerSelected,
    api,
    arrangeMasonryCards,
    detail: ui.detail,
    shell: ui.shell,
    copyText,
    showToast
  };
  friendViews.renderDetail(
    ui.detail,
    { state, friend, self: friend ? null : normalizeSelfProfile(state.selfProfile), bridge },
    friend ? friend.key : 'self'
  );
}

function renderFriends() {
  if (state.selectedSelf) {
    if (state.selfProfile) renderSvelteFriendDetail(null);
    else {
      friendViews.clearDetail();
      setHeader('', '', '');
      ui.detailHeader.classList.add('is-friend-detail');
      ui.detail.classList.add('is-friend-detail');
      ui.detail.replaceChildren(
        state.selfProfileLoading
          ? loadingState('내 프로필을 불러오는 중…', true)
          : emptyState(
              '내 프로필을 불러올 수 없습니다',
              state.selfProfileError || '프로필을 다시 요청해 주세요.',
              loadSelfProfile
            )
      );
    }
    return;
  }
  const friend = currentFriend();
  if (friend) {
    renderSvelteFriendDetail(friend);
    return;
  }
  setHeader('', '', '');
  if (state.friendsLoading && !state.friendsLoaded) {
    ui.detail.replaceChildren(loadingState('친구 목록을 불러오는 중…', true));
  } else if (state.friendsError && !state.friendsLoaded) {
    ui.detail.replaceChildren(emptyState('친구 목록을 불러올 수 없습니다', state.friendsError, loadFriends));
  } else {
    ui.detail.replaceChildren(emptyState('친구를 선택하세요', '왼쪽 목록에서 친구를 선택해 프로필 정보를 확인하세요.'));
  }
}

export function renderDetail() {
  if (state.tab !== 'friends' || state.connection !== 'connected' || (!state.selectedSelf && !currentFriend()))
    friendViews.clearDetail();
  const channel = ['chat', 'openchat'].includes(state.tab) ? currentChannel() : null;
  const group = state.tab === 'openchat' ? selectedOpenGroup() : null;
  const svelteDetail =
    (state.tab === 'roles' && (state.rolesLoaded || (!state.rolesLoading && !state.rolesError))) ||
    (state.connection === 'connected' && Boolean(channel || group));
  if (!svelteDetail) roomViews.clearDetail();
  if (
    channel &&
    state.selectedMemberId &&
    state.members.has(channel.id) &&
    !state.members.get(channel.id)?.some((member) => member.id === state.selectedMemberId)
  ) {
    state.selectedMemberId = null;
  }
  if (state.tab !== 'home' && homeController) {
    homeController.dispose();
    homeController = null;
  }
  if (state.tab === 'settings' && settingsCleanup) return;
  ui.detailHeader.hidden =
    ['home', 'settings', 'chat', 'openchat'].includes(state.tab) ||
    (state.tab === 'friends' && !state.selectedSelf && !currentFriend());
  settingsCleanup?.();
  settingsCleanup = null;
  const scroll = ui.detail.scrollTop;
  ui.detailHeader.classList.remove('is-friend-detail');
  ui.detail.classList.remove('is-friend-detail');
  ui.memberSearchToggle.hidden = state.tab !== 'roles';
  ui.memberRefresh.hidden = state.tab !== 'roles';
  if (state.tab === 'home') {
    if (!homeController) {
      homeController = createHomeController(
        {
          connection: state.connection,
          connectionId: getActiveConnectionId()
        },
        showToast
      );
      ui.detail.replaceChildren(homeController.node);
    } else homeController.update({ connection: state.connection, connectionId: getActiveConnectionId() });
  } else if (state.tab === 'settings') {
    renderSettingsDetail();
  } else if (state.tab !== 'roles' && state.connection !== 'connected') {
    ui.detailHeader.hidden = true;
    ui.memberSearchToggle.hidden = true;
    ui.memberRefresh.hidden = true;
    ui.detail.replaceChildren(
      state.connection === 'checking'
        ? loadingState(channel ? '멤버 목록을 불러오는 중…' : '연결 상태를 확인하는 중…', true)
        : emptyState(
            channel
              ? '멤버 목록을 불러올 수 없습니다.'
              : state.connection === 'disconnected'
                ? 'Arisa에 연결할 수 없습니다'
                : '대시보드에 연결할 수 없습니다',
            channel ? '' : '연결이 복구되면 자동으로 다시 불러옵니다.',
            checkConnection
          )
    );
  } else if (state.tab === 'friends') {
    renderFriends();
  } else if (state.tab === 'roles') {
    const label = state.roleView === 'admin' ? '관리자' : '밴 유저';
    setHeader(
      label,
      `전체 채팅방 · ${state.roles[state.roleView].size}명`,
      '',
      state.roleView === 'admin' ? 'users' : 'user'
    );
    if (svelteDetail) {
      roomViews.renderDetail(ui.detail, roomSnapshot());
    } else {
      ui.detail.replaceChildren(
        state.rolesLoading
          ? loadingState('권한을 불러오는 중…', true)
          : emptyState('권한을 불러올 수 없습니다', state.rolesError, loadRoles)
      );
    }
  } else if (channel) {
    roomViews.renderDetail(ui.detail, roomSnapshot());
  } else if (group) {
    roomViews.renderDetail(ui.detail, roomSnapshot());
  } else {
    setHeader('', '', '');
    ui.detail.replaceChildren(emptyState('채팅방을 선택하세요', '왼쪽 목록에서 채팅방을 선택해 멤버를 확인하세요.'));
  }
  ui.detail.scrollTop = scroll;
}

function renderSettingsDetail() {
  const settings = createThemeSettings();
  settingsCleanup = settings.cleanup;
  ui.detail.replaceChildren(settings.node);
}

export function disposeHome() {
  homeController?.dispose();
  homeController = null;
}
