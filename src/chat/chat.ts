/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { FeedChat } from './feed.js';
import type { MessageChat } from './message.js';
import type { User } from '../user/user.js';

/** 메세지({@link MessageChat})와 피드({@link FeedChat})의 공통 부모입니다. */
export class Chat {
  /** 메세지를 보냈거나 피드와 관련된 유저입니다. 유저 정보가 없으면 `null`입니다. */
  readonly user: User | null;

  /** @internal */
  constructor(user: User | null) {
    this.user = user;
  }

  /** 메세지이면 `true`입니다. `true`이면 타입이 {@link MessageChat}으로 좁혀집니다. */
  isMessageChat(): this is MessageChat {
    return false;
  }

  /** 피드이면 `true`입니다. `true`이면 타입이 {@link FeedChat}으로 좁혀집니다. */
  isFeedChat(): this is FeedChat {
    return false;
  }
}
