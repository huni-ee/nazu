/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { LinkMemberType, type Member, ProfileType } from '../grpc/generated/arisa.pb.js';
import type { OpenMemberType, OpenProfileType, OpenUserRaw } from '../types/user.js';
import { User } from './user.js';

/** 오픈채팅방 유저입니다. */
export class OpenUser extends User {
  /** 오픈채팅 프로필 종류입니다. */
  readonly profileType: OpenProfileType;
  /** 오픈채팅방에서의 멤버 종류입니다. */
  readonly memberType: OpenMemberType;
  /** 오픈프로필 링크 ID입니다. */
  readonly profileLinkId: string;

  constructor(
    id: string,
    name: string,
    profileImageUrl: string | null,
    profileType: OpenProfileType,
    memberType: OpenMemberType,
    profileLinkId: string
  ) {
    super(id, name, profileImageUrl);
    this.profileType = profileType;
    this.memberType = memberType;
    this.profileLinkId = profileLinkId;
  }

  override get raw(): OpenUserRaw {
    return {
      id: this.id,
      isMine: false,
      name: this.name,
      customName: null,
      profileImageUrl: this.profileImageUrl,
      openChannel: {
        memberType: this.memberType,
        profileType: this.profileType,
        profileLinkId: this.profileLinkId
      }
    };
  }

  /** @internal 서버의 멤버 데이터로 유저를 만듭니다. 오픈채팅 정보가 없으면 오류가 납니다. */
  static from(member: Member): OpenUser {
    const openChannel = member.openChannel;
    if (openChannel === undefined) throw new Error('오픈채팅 사용자 정보가 없습니다.');

    return new OpenUser(
      member.id,
      member.nickname,
      member.profileImageUrl ?? null,
      toProfileType(openChannel.profileType),
      toMemberType(openChannel.linkMemberType),
      openChannel.profileLinkId
    );
  }

  override isOpenUser(): this is OpenUser {
    return true;
  }

  override isHost(): boolean {
    return this.memberType === 'host';
  }

  override isModerator(): boolean {
    return this.memberType === 'moderator';
  }
}

function toProfileType(profileType: ProfileType): OpenProfileType {
  if (profileType === ProfileType.PROFILE_TYPE_DEFAULT) return 'default';
  if (profileType === ProfileType.PROFILE_TYPE_KAKAO) return 'kakao';
  if (profileType === ProfileType.PROFILE_TYPE_OPEN) return 'open';
  return 'unknown';
}

function toMemberType(memberType: LinkMemberType): OpenMemberType {
  if (memberType === LinkMemberType.LINK_MEMBER_TYPE_HOST) return 'host';
  if (memberType === LinkMemberType.LINK_MEMBER_TYPE_MEMBER) return 'member';
  if (memberType === LinkMemberType.LINK_MEMBER_TYPE_MODERATOR) return 'moderator';
  if (memberType === LinkMemberType.LINK_MEMBER_TYPE_BOT) return 'bot';
  return 'unknown';
}
