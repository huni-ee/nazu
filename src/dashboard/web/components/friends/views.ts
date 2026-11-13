/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { flushSync, mount, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import type { Component } from 'svelte';
import FriendList from './FriendList.svelte';
import FriendDetail from './FriendDetail.svelte';

type View = {
  target: Element;
  anchor: Comment;
  store: Writable<unknown>;
  instance: Record<string, unknown>;
  key: string;
};

export function createFriendViews() {
  let list: View | null = null;
  let detail: View | null = null;

  function clear(view: View | null) {
    if (view) flushSync(() => void unmount(view.instance));
  }

  function render(
    view: View | null,
    target: Element,
    component: Component<{ snapshot: Writable<unknown> }>,
    snapshot: unknown,
    key: string
  ): View {
    if (view && view.target === target && view.key === key && target.contains(view.anchor)) {
      flushSync(() => view.store.set(snapshot));
      return view;
    }
    clear(view);
    target.replaceChildren();
    const anchor = document.createComment('friend-view');
    target.append(anchor);
    const store = writable(snapshot);
    let instance!: Record<string, unknown>;
    flushSync(() => {
      instance = mount(component, { target, anchor, props: { snapshot: store } });
    });
    return { target, anchor, store, instance, key };
  }

  return {
    renderList(target: Element, snapshot: unknown) {
      list = render(list, target, FriendList, snapshot, 'list');
    },
    renderDetail(target: Element, snapshot: unknown, key: string) {
      detail = render(detail, target, FriendDetail, snapshot, key);
    },
    clearList() {
      clear(list);
      list = null;
    },
    clearDetail() {
      clear(detail);
      detail = null;
    }
  };
}
