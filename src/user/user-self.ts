/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { getSelfProfile } from '../api/auth.js';
import type { Member } from '../grpc/generated/arisa.pb.js';
import type { NormalMemberType, OpenMemberType, OpenProfileType, UserSelfRaw } from '../types/user.js';
import { OpenUser } from './open-user.js';
import { User } from './user.js';

/** 내 계정입니다. 일반 채팅방과 오픈채팅방 모두 이 클래스로 받습니다. */
export class UserSelf extends User {
  /** 오픈채팅 프로필 종류입니다. 일반 채팅방에서는 `default`입니다. */
  readonly profileType: OpenProfileType;
  /** 채팅방에서의 멤버 종류입니다. */
  readonly memberType: OpenMemberType;
  /** 오픈프로필 링크 ID입니다. 일반 채팅방에서는 `null`입니다. */
  readonly profileLinkId: string | null;

  constructor(
    id: string,
    name: string,
    profileImageUrl: string | null = null,
    profileType: OpenProfileType = 'default',
    memberType: OpenMemberType = 'member',
    profileLinkId: string | null = null,
    customName: string | null = null
  ) {
    super(id, name, profileImageUrl, customName);
    this.profileType = profileType;
    this.memberType = memberType;
    this.profileLinkId = profileLinkId;
  }

  override get raw(): UserSelfRaw {
    const user = {
      id: this.id,
      isMine: true,
      name: this.name,
      customName: this.customName,
      profileImageUrl: this.profileImageUrl
    };
    return this.profileLinkId === null
      ? {
          ...user,
          memberType: this.memberType,
          profileType: 'default'
        }
      : {
          ...user,
          openChannel: {
            memberType: this.memberType,
            profileType: this.profileType,
            profileLinkId: this.profileLinkId
          }
        };
  }

  /** @internal 일반 채팅방 멤버 데이터로 내 계정을 만듭니다. 이름은 `botName`, 저장된 내 프로필 닉네임, 멤버 닉네임 순서로 씁니다. */
  static fromNormal(
    member: Member,
    botName: string | null = null,
    memberType: NormalMemberType = 'member',
    customName: string | null = null
  ): UserSelf {
    const profile = getSelfProfile(member.id);
    return new UserSelf(
      member.id,
      botName || profile?.nickname || member.nickname,
      profile?.originalProfileImageUrl || member.profileImageUrl || null,
      'default',
      memberType,
      null,
      customName
    );
  }

  /** @internal 오픈채팅방 멤버 데이터로 내 계정을 만듭니다. `botName`이 있으면 그 이름을 씁니다. */
  static fromOpen(member: Member, botName: string | null = null): UserSelf {
    const user = OpenUser.from(member);
    return new UserSelf(
      user.id,
      botName || user.name,
      user.profileImageUrl,
      user.profileType,
      user.memberType,
      user.profileLinkId
    );
  }

  override isMine(): this is UserSelf {
    return true;
  }

  override isNormalUser(): this is UserSelf {
    return this.profileLinkId === null;
  }

  override isOpenUser(): this is UserSelf {
    return this.profileLinkId !== null;
  }

  override isHost(): boolean {
    return this.memberType === 'host';
  }

  override isModerator(): boolean {
    return this.memberType === 'moderator';
  }
}
