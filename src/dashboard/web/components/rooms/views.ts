/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { flushSync, mount, unmount } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import type { Component } from 'svelte';
import RoomList from './RoomList.svelte';
import RoomDetail from './RoomDetail.svelte';

// 상태와 API 요청은 대시보드 컨트롤러가 맡고, 상태가 바뀌면 새 스냅샷으로 Svelte를 갱신한다.
type View = {
  target: Element;
  anchor: Comment;
  store: Writable<unknown>;
  instance: Record<string, unknown>;
};

export function createRoomViews() {
  let list: View | null = null;
  let detail: View | null = null;
  function clear(current: View | null) {
    if (current) flushSync(() => void unmount(current.instance));
  }
  function render(
    current: View | null,
    target: Element,
    component: Component<{ snapshot: Writable<unknown> }>,
    snapshot: unknown
  ): View {
    if (current && current.target === target && target.contains(current.anchor)) {
      flushSync(() => current.store.set(snapshot));
      return current;
    }
    clear(current);
    target.replaceChildren();
    // host의 자식은 Svelte가 관리한다. 다른 화면이 host를 가져갔는지는 이 주석 노드로 확인한다.
    const anchor = document.createComment('svelte-room-view');
    target.append(anchor);
    const store = writable(snapshot);
    let instance!: Record<string, unknown>;
    flushSync(() => {
      instance = mount(component, { target, anchor, props: { snapshot: store } });
    });
    return { target, anchor, store, instance };
  }
  return {
    renderList(target: Element, snapshot: unknown) {
      list = render(list, target, RoomList, snapshot);
    },
    renderDetail(target: Element, snapshot: unknown) {
      detail = render(detail, target, RoomDetail, snapshot);
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
