/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { element, icon } from './dom.js';

interface Profile {
  name?: string;
  profileImageUrl?: unknown;
  [key: string]: unknown;
}
interface ConnectionEntry {
  id: string;
  target?: string;
  connected?: boolean;
  connecting?: boolean;
  stopped?: boolean;
  me?: Profile;
}
interface ConnectionsPayload {
  connections: ConnectionEntry[];
  defaultConnectionId?: string;
}
interface SwitcherOptions {
  node: HTMLElement;
  requestConnections: () => Promise<ConnectionsPayload>;
  getActiveId: () => string;
  onSelect: (id: string) => void;
  onConnectionAction: (id: string, action: 'connect' | 'disconnect') => Promise<Partial<ConnectionEntry>>;
}
type Avatar = { node: HTMLSpanElement; update: (value: unknown) => void; cleanup: () => void };
type Row = {
  node: HTMLButtonElement;
  avatar: Avatar;
  name: HTMLSpanElement;
  target: HTMLSpanElement;
  status: HTMLSpanElement;
  statusText: HTMLSpanElement;
  check: HTMLSpanElement;
  cleanup: () => void;
};

let switcherSequence = 0;

export function createProfileSwitcher({
  node,
  requestConnections,
  getActiveId,
  onSelect,
  onConnectionAction
}: SwitcherOptions) {
  const id = `profile-switcher-${++switcherSequence}`;
  const trigger = element('button', 'profile-switcher-trigger');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', `${id}-panel`);
  trigger.setAttribute('aria-expanded', 'false');
  const avatar = createAvatar();
  const badge = element('span', 'profile-switcher-status');
  badge.setAttribute('aria-hidden', 'true');
  badge.append(element('span', 'profile-switcher-dot'));
  trigger.append(avatar.node, badge);

  const popover = element('div', 'profile-switcher-popover');
  popover.id = `${id}-panel`;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', '계정 및 연결 관리');
  popover.hidden = true;
  const current = element('div', 'profile-switcher-current');
  const currentAvatar = createAvatar();
  const currentInfo = element('div', 'profile-switcher-current-info');
  const currentName = element('span', 'profile-switcher-current-name');
  const currentTarget = element('span', 'profile-switcher-target');
  const currentStatus = element('span', 'profile-switcher-current-status');
  const currentStatusText = element('span');
  currentStatus.append(element('span', 'profile-switcher-dot'), currentStatusText);
  currentInfo.append(currentName, currentTarget, currentStatus);
  current.append(currentAvatar.node, currentInfo);
  const sectionTitle = element('p', 'profile-switcher-section-title', '계정 전환');
  const list = element('div', 'profile-switcher-options');
  list.id = `${id}-options`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', '계정');
  const empty = element('p', 'profile-switcher-empty', '계정을 불러오는 중…');
  empty.setAttribute('role', 'status');
  const footer = element('div', 'profile-switcher-footer');
  const action = element('button', 'profile-switcher-action');
  action.type = 'button';
  const feedback = element('p', 'profile-switcher-feedback');
  feedback.setAttribute('role', 'status');
  feedback.hidden = true;
  footer.append(action, feedback);
  popover.append(current, sectionTitle, list, empty, footer);
  node.append(trigger, popover);

  let entries: ConnectionEntry[] = [];
  let defaultId = '';
  let open = false;
  let disposed = false;
  let loaded = false;
  let inFlight: Promise<ConnectionsPayload | null> | null = null;
  let activeId = '';
  let revision = 0;
  let busy = false;
  let pendingAction: 'connect' | 'disconnect' | '' = '';
  const profileUpdates = new Map<string, { revision: number; profile: Profile }>();
  const rows = new Map<string, Row>();
  const listeners: (() => void)[] = [];

  function listen<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void
  ) {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  }

  function createAvatar() {
    const node = element('span', 'profile profile-switcher-avatar');
    node.setAttribute('aria-hidden', 'true');
    const fallback = element('span', 'profile-fallback');
    fallback.append(icon('user'));
    const image = element('img');
    image.alt = '';
    image.referrerPolicy = 'no-referrer';
    image.hidden = true;
    node.append(fallback, image);
    let currentSrc = '';
    let failed = false;
    const onLoad = () => {
      if (!failed && currentSrc) fallback.hidden = true;
    };
    const onError = () => {
      failed = true;
      image.hidden = true;
      fallback.hidden = false;
    };
    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
    return {
      node,
      update(value: unknown) {
        let src = '';
        if (typeof value === 'string' && value) {
          try {
            const url = new URL(value, document.baseURI);
            if (url.protocol === 'https:' || url.protocol === 'http:') src = url.href;
          } catch {
            // 이미지 주소가 없거나 잘못되면 기본 아이콘을 둔다.
          }
        }
        if (src === currentSrc) return;
        currentSrc = src;
        failed = false;
        fallback.hidden = false;
        image.hidden = !src;
        if (src) image.src = src;
        else image.removeAttribute('src');
      },
      cleanup() {
        image.removeEventListener('load', onLoad);
        image.removeEventListener('error', onError);
      }
    };
  }

  function selectedEntry() {
    const selectedId = getActiveId() || defaultId;
    return entries.find((entry) => entry.id === selectedId);
  }

  function accountName(entry: ConnectionEntry | undefined) {
    return [entry?.me?.name, entry?.target].find((value) => typeof value === 'string' && value.trim()) || '계정';
  }

  function connectionState(entry: ConnectionEntry | undefined) {
    return entry?.connected
      ? 'connected'
      : entry?.connecting
        ? 'connecting'
        : entry?.stopped
          ? 'stopped'
          : 'disconnected';
  }

  function connectionLabel(entry: ConnectionEntry | undefined) {
    return entry?.connected ? '연결됨' : entry?.connecting ? '연결 중…' : entry?.stopped ? '연결 종료됨' : '연결 끊김';
  }

  function activate(nextId: string, focus = false) {
    activeId = rows.has(nextId) ? nextId : '';
    rows.forEach((row, rowId) => {
      row.node.classList.toggle('is-active', rowId === activeId);
      row.node.tabIndex = rowId === activeId ? 0 : -1;
    });
    if (focus && open && activeId) {
      rows.get(activeId)!.node.focus();
      rows.get(activeId)!.node.scrollIntoView({ block: 'nearest' });
    }
  }

  function render() {
    const selected = selectedEntry();
    const label = selected ? accountName(selected) : '계정 선택';
    avatar.update(selected?.me?.profileImageUrl);
    badge.dataset.state = connectionState(selected);
    trigger.title = selected ? `${label} · ${connectionLabel(selected)} (${selected.target})` : label;
    trigger.setAttribute('aria-label', selected ? `계정 관리: ${label}, ${connectionLabel(selected)}` : label);
    current.hidden = !selected;
    currentAvatar.update(selected?.me?.profileImageUrl);
    currentName.textContent = label;
    currentTarget.textContent = selected?.target || '';
    currentStatus.dataset.state = connectionState(selected);
    currentStatusText.textContent = connectionLabel(selected);
    sectionTitle.hidden = !entries.length;
    footer.hidden = !selected;
    const nextAction = selected?.connected || selected?.connecting ? 'disconnect' : 'connect';
    action.dataset.action = busy ? pendingAction : nextAction;
    action.disabled = busy || !selected;
    action.setAttribute('aria-busy', String(busy));
    action.textContent = busy
      ? pendingAction === 'disconnect'
        ? '연결 종료 중…'
        : '연결 중…'
      : nextAction === 'disconnect'
        ? '연결 종료'
        : '다시 연결';
    action.setAttribute('aria-label', `${label} ${action.textContent}`);
    const nameCounts = new Map<string, number>();
    entries.forEach((entry) => nameCounts.set(accountName(entry), (nameCounts.get(accountName(entry)) || 0) + 1));
    const nextRows = entries.map((entry, index) => {
      let row = rows.get(entry.id);
      if (!row) {
        const rowNode = element('button', 'profile-switcher-option');
        rowNode.type = 'button';
        rowNode.tabIndex = -1;
        rowNode.id = `${id}-option-${index}-${++switcherSequence}`;
        rowNode.value = entry.id;
        rowNode.setAttribute('role', 'option');
        const rowAvatar = createAvatar();
        const text = element('span', 'profile-switcher-account');
        const rowName = element('span', 'profile-switcher-account-name');
        const target = element('span', 'profile-switcher-target');
        text.append(rowName, target);
        const status = element('span', 'profile-switcher-status');
        const dot = element('span', 'profile-switcher-dot');
        dot.setAttribute('aria-hidden', 'true');
        const statusText = element('span', 'profile-switcher-status-text');
        status.append(dot, statusText);
        const check = element('span', 'profile-switcher-check', '✓');
        check.setAttribute('aria-hidden', 'true');
        rowNode.append(rowAvatar.node, text, status, check);
        const choose = () => select(entry.id);
        const focus = () => activate(entry.id);
        rowNode.addEventListener('click', choose);
        rowNode.addEventListener('focus', focus);
        row = {
          node: rowNode,
          avatar: rowAvatar,
          name: rowName,
          target,
          status,
          statusText,
          check,
          cleanup() {
            rowNode.removeEventListener('click', choose);
            rowNode.removeEventListener('focus', focus);
            rowAvatar.cleanup();
          }
        };
        rows.set(entry.id, row);
      }
      const current = entry.id === selected?.id;
      const nickname = accountName(entry);
      const showTarget = (nameCounts.get(nickname) || 0) > 1 && entry.target && entry.target !== nickname;
      row.name.textContent = nickname;
      row.target.textContent = entry.target || '';
      row.target.hidden = !showTarget;
      row.avatar.update(entry.me?.profileImageUrl);
      row.status.setAttribute('data-state', connectionState(entry));
      row.statusText.textContent = connectionLabel(entry);
      row.node.disabled = busy;
      row.check.hidden = !current;
      row.node.setAttribute('aria-selected', String(current));
      row.node.setAttribute(
        'aria-label',
        `${nickname}${showTarget ? `, ${entry.target}` : ''}, ${row.statusText.textContent}${current ? ', 현재 계정' : ''}`
      );
      return row.node;
    });
    for (const [rowId, row] of rows) {
      if (!entries.some((entry) => entry.id === rowId)) {
        row.cleanup();
        rows.delete(rowId);
      }
    }
    // 주기적으로 갱신할 때 기존 행을 그대로 고쳐 스크롤과 키보드 위치를 유지한다.
    if (nextRows.length !== list.children.length || nextRows.some((row, index) => list.children[index] !== row)) {
      list.replaceChildren(...nextRows);
    }
    empty.hidden = entries.length !== 0;
    if (loaded) empty.textContent = '등록된 계정이 없습니다.';
    activate(rows.has(activeId) ? activeId : selected?.id || entries[0]?.id || '');
  }

  function outside(event: Event) {
    if (!node.contains(event.target as Node | null)) close();
  }

  function escape(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !open) return;
    event.preventDefault();
    close({ focus: node.contains(document.activeElement) });
  }

  function close({ focus = false } = {}) {
    if (!open) return;
    open = false;
    popover.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside);
    document.removeEventListener('click', outside);
    document.removeEventListener('focusin', outside);
    document.removeEventListener('keydown', escape);
    if (focus && !disposed) trigger.focus();
  }

  function show({ focus = false } = {}) {
    if (disposed) return;
    if (!open) {
      open = true;
      popover.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      activate(selectedEntry()?.id || entries[0]?.id || '');
      document.addEventListener('pointerdown', outside);
      document.addEventListener('click', outside);
      document.addEventListener('focusin', outside);
      document.addEventListener('keydown', escape);
    }
    if (focus) activate(activeId, true);
  }

  function select(id: string) {
    if (disposed || busy || !open || !rows.has(id)) return;
    feedback.hidden = true;
    close({ focus: true });
    onSelect(id);
  }

  function onKeydown(event: KeyboardEvent) {
    if (disposed || busy) return;
    if (event.key === 'Escape') {
      escape(event);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const wasOpen = open;
      show();
      if (!entries.length) return;
      const index = entries.findIndex((entry) => entry.id === activeId);
      let next = index;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = entries.length - 1;
      else if (wasOpen) next = (index + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length;
      else if (!selectedEntry() && event.key === 'ArrowUp') next = entries.length - 1;
      activate(entries[next].id, true);
    }
  }

  listen(trigger, 'click', () => {
    if (open) close();
    else show({ focus: true });
  });
  listen(trigger, 'keydown', onKeydown);
  listen(list, 'keydown', onKeydown);
  listen(node, 'focusout', (event) => {
    if (!busy && !node.contains(event.relatedTarget as Node | null)) close();
  });
  listen(action, 'click', () => {
    void (async () => {
      const selected = selectedEntry();
      if (busy || !selected) return;
      busy = true;
      pendingAction = selected.connected || selected.connecting ? 'disconnect' : 'connect';
      feedback.hidden = true;
      render();
      try {
        const result = await onConnectionAction(selected.id, pendingAction);
        if (disposed) return;
        const entry = entries.find((entry) => entry.id === selected.id);
        if (entry) Object.assign(entry, result);
      } catch (error) {
        if (disposed) return;
        feedback.textContent =
          (error as { message?: string }).message || '연결 상태를 변경하지 못했습니다. 다시 시도해 주세요.';
        feedback.classList.add('is-error');
        feedback.hidden = false;
      } finally {
        busy = false;
        pendingAction = '';
        if (!disposed) {
          render();
          if (open && !node.contains(document.activeElement)) action.focus();
        }
      }
    })();
  });
  render();

  return {
    refresh() {
      if (disposed) return Promise.resolve(null);
      if (inFlight) return inFlight;
      const requestRevision = revision;
      inFlight = Promise.resolve()
        .then(() => requestConnections())
        .then((payload) => {
          if (disposed) return null;
          if (!payload || !Array.isArray(payload.connections)) throw new Error('Invalid connections response');
          const ids = new Set<string>();
          entries = payload.connections
            .filter((entry) => {
              if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id)) return false;
              ids.add(entry.id);
              return true;
            })
            .map((entry) => {
              const update = profileUpdates.get(entry.id);
              return update && update.revision > requestRevision ? { ...entry, me: update.profile } : { ...entry };
            });
          defaultId = typeof payload.defaultConnectionId === 'string' ? payload.defaultConnectionId : '';
          loaded = true;
          render();
          return payload;
        })
        .catch(() => {
          if (!disposed && !loaded) empty.textContent = '계정 목록을 불러올 수 없습니다.';
          return null;
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    updateProfile(profile: Profile) {
      if (disposed || !profile || typeof profile !== 'object') return;
      const selected = selectedEntry();
      if (!selected) return;
      selected.me = { ...selected.me, ...profile };
      profileUpdates.set(selected.id, { revision: ++revision, profile: selected.me });
      render();
    },
    cleanup() {
      if (disposed) return;
      disposed = true;
      close();
      listeners.forEach((remove) => remove());
      rows.forEach((row) => row.cleanup());
      avatar.cleanup();
      currentAvatar.cleanup();
    }
  };
}
