/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { byId } from '../utils/dom.js';

export function requireElement(id: string): HTMLElement {
  const node = byId(id);
  if (!node) throw new Error(`Required dashboard element not found: ${id}`);
  return node;
}

function requireInput(id: string): HTMLInputElement {
  const node = requireElement(id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`Dashboard element is not an input: ${id}`);
  return node;
}

function requireButton(id: string): HTMLButtonElement {
  const node = requireElement(id);
  if (!(node instanceof HTMLButtonElement)) throw new Error(`Dashboard element is not a button: ${id}`);
  return node;
}

export const ui = {
  shell: requireElement('app-shell'),
  profileSwitcher: requireElement('profile-switcher'),
  listTitle: requireElement('list-title'),
  list: requireElement('channel-list'),
  listSearchWrap: requireElement('list-search-wrap'),
  listSearch: requireInput('list-search'),
  listSearchToggle: requireElement('list-search-toggle'),
  listRefresh: requireButton('list-refresh'),
  detailHeader: requireElement('detail-header'),
  detailTitle: requireElement('detail-title'),
  detailSubtitle: requireElement('detail-subtitle'),
  headerProfile: requireElement('header-profile'),
  detail: requireElement('detail-scroll'),
  memberSearchToggle: requireElement('member-search-toggle'),
  memberRefresh: requireElement('member-refresh'),
  dialogRoot: requireElement('dialog-root'),
  toast: requireElement('toast')
};
