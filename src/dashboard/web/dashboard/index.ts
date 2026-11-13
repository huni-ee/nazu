/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

// 화면 구성은 KiwiTalk(https://github.com/KiwiTalk/KiwiTalk, Apache-2.0)를 참고했다.

import { setArisaConnection } from '../utils/api.js';
import { requireElement, ui } from './ui.js';
import { state } from './state.js';
import { closeDialog } from './views.js';
import {
  connectionMonitor,
  initializeConnections,
  isConnectionsInitialized,
  onArisaDisconnected,
  checkConnection
} from './connections.js';
import { loadMembers } from './channels.js';
import { loadRoles } from './roles.js';
import { renderList, refreshList } from './list.js';
import { disposeHome, renderDetail } from './detail.js';
import { render } from './render.js';
import { setTab, goBack } from './navigation.js';

requireElement('nav-home').addEventListener('click', () => setTab('home'));
requireElement('nav-friends').addEventListener('click', () => setTab('friends'));
requireElement('nav-settings').addEventListener('click', () => setTab('settings'));
requireElement('nav-chat').addEventListener('click', () => setTab('chat'));
requireElement('nav-openchat').addEventListener('click', () => setTab('openchat'));
requireElement('back-button').addEventListener('click', goBack);
ui.listSearchToggle.addEventListener('click', () => {
  if (ui.listSearchWrap.dataset.open) {
    delete ui.listSearchWrap.dataset.open;
    state.listQuery = '';
    ui.listSearch.value = '';
  } else {
    ui.listSearchWrap.dataset.open = 'true';
  }
  renderList();
  if (!ui.listSearchWrap.hidden) ui.listSearch.focus();
  else ui.listSearchToggle.focus();
});
ui.listSearch.addEventListener('input', () => {
  state.listQuery = ui.listSearch.value;
  renderList();
});

ui.listRefresh.addEventListener('click', () => {
  void refreshList();
});
ui.memberSearchToggle.addEventListener('click', () => {
  const search = ui.detail.querySelector<HTMLInputElement>('.member-search input');
  if (search) {
    search.focus();
    search.scrollIntoView({ block: 'nearest' });
  }
});
ui.memberRefresh.addEventListener('click', () => {
  if (state.tab === 'roles') void loadRoles();
  else if (state.connection !== 'connected') void checkConnection();
  else if (state.selectedChannelId) void loadMembers(state.selectedChannelId, true);
});

window.addEventListener('pagehide', () => {
  connectionMonitor.stop();
  closeDialog();
  disposeHome();
});
window.addEventListener('pageshow', () => {
  if (isConnectionsInitialized()) {
    if (['home', 'chat', 'openchat'].includes(state.tab)) renderDetail();
    void connectionMonitor.start();
  }
});
setArisaConnection(false, onArisaDisconnected);
render();
void initializeConnections();
