/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

// 프로필이 바뀌거나 화면을 닫으면 영상 리소스를 정리한다.
export function profileVideo(node: HTMLVideoElement) {
  function playing() {
    node.classList.add('is-playing');
  }
  node.addEventListener('playing', playing);
  return {
    destroy() {
      node.removeEventListener('playing', playing);
      node.pause();
      node.removeAttribute('src');
      node.load();
    }
  };
}
