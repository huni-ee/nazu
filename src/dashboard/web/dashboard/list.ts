/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { element } from '../utils/dom.js';
import { ui } from './ui.js';
import { state } from './state.js';
import { roomViews, friendViews } from './views.js';
import { errorMessage, loadingListItem } from './placeholders.js';
import { checkConnection } from './connections.js';
import { loadChannels } from './channels.js';
import { loadRoles } from './roles.js';
import { updatedFriendEntries, birthdayFriendEntries, loadMe, loadSelfProfile, loadFriends } from './friends.js';
import { roomSnapshot } from './render.js';
import { selectFriend, selectSelf } from './navigation.js';

let listRefreshPending = false;

export function renderList() {
  const focusedGroup =
    ui.list.contains(document.activeElement) && document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset.friendGroup
      : undefined;
  const scrollContainer = ui.list.parentElement;
  if (!scrollContainer) throw new Error('Dashboard list has no scroll container');
  const scrollTop = scrollContainer.scrollTop;
  renderListContent();
  if (focusedGroup) {
    scrollContainer.scrollTop = scrollTop;
    ui.list.querySelector<HTMLElement>(`[data-friend-group="${focusedGroup}"]`)?.focus({ preventScroll: true });
  }
}

function renderListContent() {
  const roomTab = ['chat', 'openchat', 'roles'].includes(state.tab);
  const clearList = () => {
    roomViews.clearList();
    friendViews.clearList();
    ui.list.replaceChildren();
  };
  if (state.tab !== 'friends') friendViews.clearList();
  if (!roomTab && state.tab !== 'friends') clearList();
  if (state.tab === 'friends') roomViews.clearList();
  ui.listTitle.textContent =
    state.tab === 'home'
      ? '홈'
      : state.tab === 'settings'
        ? '설정'
        : state.tab === 'friends'
          ? '친구'
          : state.tab === 'roles'
            ? '전체 권한'
            : state.tab === 'openchat'
              ? '오픈채팅방'
              : '채팅방';
  ui.listSearchToggle.hidden = ['home', 'roles', 'settings'].includes(state.tab);
  ui.listRefresh.hidden = state.tab === 'home' || state.tab === 'settings';
  updateListRefresh();
  ui.listSearchWrap.hidden = ui.listSearchToggle.hidden || !ui.listSearchWrap.dataset.open;
  ui.listSearchToggle.setAttribute('aria-expanded', String(!ui.listSearchWrap.hidden));
  ui.listSearch.placeholder =
    state.tab === 'friends' ? '친구 검색' : state.tab === 'openchat' ? '오픈채팅방 검색' : '채팅방 검색';
  ui.listSearch.setAttribute('aria-label', ui.listSearch.placeholder);
  const searchLabel = ui.listSearchWrap.hidden ? ui.listSearch.placeholder : '검색 닫기';
  ui.listSearchToggle.setAttribute('aria-label', searchLabel);
  ui.listSearchToggle.title = searchLabel;
  if (state.tab === 'home') return;
  if (state.tab === 'settings') return;
  if (state.tab !== 'roles' && state.connection !== 'connected') {
    const loaded = state.tab === 'friends' ? state.friendsLoaded : state.channelsLoaded;
    if (!loaded) {
      clearList();
      ui.list.append(
        state.connection === 'checking'
          ? loadingListItem('연결 상태를 확인하는 중…')
          : element('li', 'channel-empty', '연결 후 목록이 표시됩니다.')
      );
      return;
    }
  }
  if (state.tab === 'friends') {
    friendViews.renderList(ui.list, {
      state,
      selectSelf,
      selectFriend,
      loadMe,
      loadFriends,
      updatedFriendEntries,
      birthdayFriendEntries,
      toggleGroup(
        key:
          | 'updatedFriendsExpanded'
          | 'birthdayFriendsExpanded'
          | 'favoritesExpanded'
          | 'friendsExpanded'
          | 'hiddenFriendsExpanded'
      ) {
        state[key] = !state[key];
        renderList();
      }
    });
    return;
  }
  if (state.tab === 'roles') {
    if (state.rolesError && !state.rolesLoaded) {
      clearList();
      ui.list.append(errorMessage(state.rolesError, loadRoles));
      return;
    }
    if (state.rolesLoading && !state.rolesLoaded) {
      clearList();
      ui.list.append(loadingListItem('권한을 불러오는 중…'));
      return;
    }
    roomViews.renderList(ui.list, roomSnapshot());
    return;
  }
  if (state.channelsError && !state.channelsLoaded) {
    clearList();
    ui.list.append(errorMessage(state.channelsError, loadChannels));
    return;
  }
  if (state.channelsLoading && !state.channelsLoaded) {
    clearList();
    ui.list.append(loadingListItem('채팅방을 불러오는 중…'));
    return;
  }
  roomViews.renderList(ui.list, roomSnapshot());
}

function updateListRefresh() {
  const loading =
    listRefreshPending ||
    (state.tab === 'friends' && state.friendsLoading) ||
    (['chat', 'openchat'].includes(state.tab) && state.channelsLoading) ||
    (state.tab === 'roles' && state.rolesLoading);
  ui.listRefresh.disabled = loading;
  ui.listRefresh.setAttribute('aria-busy', String(loading));
}

export async function refreshList() {
  if (listRefreshPending) return;
  listRefreshPending = true;
  updateListRefresh();
  const animationDelay = new Promise((resolve) => setTimeout(resolve, 400));
  try {
    if (state.tab !== 'roles' && state.connection !== 'connected') {
      await checkConnection();
    } else if (state.tab === 'friends') {
      await Promise.allSettled([state.selectedSelf ? loadSelfProfile() : loadMe(), loadFriends()]);
    } else {
      await (state.tab === 'roles' ? loadRoles() : loadChannels());
    }
  } finally {
    await animationDelay;
    listRefreshPending = false;
    updateListRefresh();
  }
}
