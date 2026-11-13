/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

/** {@link ArisaClient} 생성자 옵션입니다. 모든 옵션은 생략할 수 있습니다. */
export type ArisaClientOptions = {
  /**
   * Arisa gRPC 서버 주소입니다. 비우거나 공백만 넣으면 기본값을 씁니다.
   * @defaultValue `127.0.0.1:3000`
   */
  readonly target?: string;
  /** 이벤트의 `UserSelf`에 표시할 내 이름입니다. 대시보드 표시에는 쓰지 않습니다. */
  readonly botName?: string;
  /**
   * 오픈프로필 변경을 확인하는 간격(밀리초)입니다.
   * @defaultValue `1500`
   */
  readonly openProfileIntervalMs?: number;
  /**
   * `start()`할 때 대시보드도 함께 켤지 정합니다.
   * @defaultValue `true`
   */
  readonly dashboard?: boolean;
  /**
   * 대시보드 포트입니다.
   * @defaultValue `3001`
   */
  readonly dashboardPort?: number;
};
