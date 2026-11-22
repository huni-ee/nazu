/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { FeedChat } from './feed.js';
import type { MessageChat } from './message.js';
import type { User } from '../user/user.js';

/**
 * 메세지({@link MessageChat})와 피드({@link FeedChat})의 공통 부모
 */
export class Chat {
  /**
   * 메세지를 보냈거나 피드와 관련된 유저. 정보가 없으면 `null`
   */
  readonly user: User | null;

  /** @internal */
  constructor(user: User | null) {
    this.user = user;
  }

  /**
   * 메세지 여부
   */
  isMessageChat(): this is MessageChat {
    return false;
  }

  /**
   * 피드 여부
   */
  isFeedChat(): this is FeedChat {
    return false;
  }
}
