/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import Home from '../components/Home.svelte';

// 홈 화면은 Svelte가 그리고, 열기·닫기 흐름은 기존 대시보드 방식을 따른다.
interface HomeState {
  connection: string;
  connectionId: string;
}

export function createHomeController(initial: HomeState, showToast: (message: string, isError?: boolean) => void) {
  const node = document.createElement('div');
  const state = writable(initial);
  const component = mount(Home, { target: node, props: { state, showToast } });
  return {
    node,
    update(value: HomeState) {
      state.set(value);
    },
    dispose() {
      void unmount(component);
    }
  };
}
