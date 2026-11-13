/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { Member } from '../grpc/generated/arisa.pb.js';
import type { BotUserRaw } from '../types/user.js';
import { User } from './user.js';

/** 채팅방에 추가된 챗봇입니다. */
export class BotUser extends User {
  /** 멤버 종류입니다. 항상 `bot`입니다. */
  readonly memberType = 'bot' as const;
  /** 프로필 종류입니다. 항상 `default`입니다. */
  readonly profileType = 'default' as const;

  constructor(id: string, name: string, profileImageUrl: string | null) {
    super(id, name, profileImageUrl);
  }

  override get raw(): BotUserRaw {
    return {
      id: this.id,
      isMine: false,
      name: this.name,
      customName: null,
      profileImageUrl: this.profileImageUrl,
      memberType: 'bot',
      profileType: 'default'
    };
  }

  /** @internal 서버의 멤버 데이터로 챗봇 유저를 만듭니다. */
  static from(member: Member): BotUser {
    return new BotUser(member.id, member.nickname, member.profileImageUrl ?? null);
  }

  override isBotUser(): this is BotUser {
    return true;
  }
}
