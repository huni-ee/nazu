/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { Member } from '../grpc/generated/arisa.pb.js';
import type { NormalMemberType, NormalUserRaw } from '../types/user.js';
import { User } from './user.js';

/** 일반 채팅방 유저입니다. */
export class NormalUser extends User {
  /** 프로필 종류입니다. 일반 채팅방에서는 항상 `default`입니다. */
  readonly profileType = 'default' as const;
  /** 채팅방에서의 멤버 종류입니다. */
  readonly memberType: NormalMemberType;

  constructor(
    id: string,
    name: string,
    profileImageUrl: string | null = null,
    memberType: NormalMemberType = 'member',
    customName: string | null = null
  ) {
    super(id, name, profileImageUrl, customName);
    this.memberType = memberType;
  }

  override get raw(): NormalUserRaw {
    return {
      id: this.id,
      isMine: false,
      name: this.name,
      customName: this.customName,
      profileImageUrl: this.profileImageUrl,
      memberType: this.memberType,
      profileType: 'default'
    };
  }

  /** @internal 서버의 멤버 데이터로 유저를 만듭니다. */
  static from(member: Member, memberType: NormalMemberType = 'member', customName: string | null = null): NormalUser {
    return new NormalUser(member.id, member.nickname, member.profileImageUrl ?? null, memberType, customName);
  }

  override isNormalUser(): this is NormalUser {
    return true;
  }

  override isHost(): boolean {
    return this.memberType === 'host';
  }

  override isModerator(): boolean {
    return this.memberType === 'moderator';
  }
}
