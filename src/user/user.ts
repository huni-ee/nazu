/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { BotUser } from './bot-user.js';
import type { NormalUser } from './normal-user.js';
import type { OpenUser } from './open-user.js';
import type { UserSelf } from './user-self.js';
import type { FeedEvent, FeedUser, Member } from '../grpc/generated/arisa.pb.js';
import type { UserRaw } from '../types/user.js';

/**
 * 유저입니다. 채팅방 종류에 따라 {@link NormalUser}, {@link OpenUser}, {@link BotUser}, {@link UserSelf}로 받습니다.
 *
 * 입장·퇴장 피드처럼 ID와 닉네임만 아는 유저는 기본 `User`로 받으며, 역할 정보가 없어서 `isHost()` 같은 메서드가 `false`입니다.
 */
export class User {
  /** 유저 ID입니다. 큰 정수라서 문자열로 다룹니다. */
  readonly id: string;
  /** 유저 이름입니다. */
  readonly name: string;
  /** 프로필 이미지 주소입니다. 없으면 `null`입니다. */
  readonly profileImageUrl: string | null;

  /** 친구 정보에서 내가 지정한 이름입니다. 없으면 `null`입니다. */
  readonly customName: string | null;

  /**
   * @param id 유저 ID입니다.
   * @param name 유저 이름입니다.
   * @param profileImageUrl 프로필 이미지 주소입니다.
   * @param customName 친구 정보에서 지정한 이름입니다.
   */
  constructor(id: string, name: string, profileImageUrl: string | null = null, customName: string | null = null) {
    this.id = id;
    this.name = name;
    this.profileImageUrl = profileImageUrl;
    this.customName = customName;
  }

  /** @internal 피드에 담긴 ID와 닉네임만으로 유저를 만듭니다. 프로필 이미지는 없습니다. */
  static fromFeed(user: FeedUser): User {
    return new User(user.id, user.nickname);
  }

  /** 유저 원본 데이터입니다. 하위 클래스는 그 종류에 맞는 데이터를 돌려줍니다. */
  get raw(): UserRaw {
    return {
      id: this.id,
      isMine: false,
      name: this.name,
      customName: this.customName,
      profileImageUrl: this.profileImageUrl
    };
  }

  /** 내 계정이면 `true`입니다. `true`이면 타입이 {@link UserSelf}로 좁혀집니다. */
  isMine(): this is UserSelf {
    return false;
  }

  /** 일반 채팅방 유저이거나 일반 채팅방의 내 계정이면 `true`입니다. */
  isNormalUser(): this is NormalUser | UserSelf {
    return false;
  }

  /** 오픈채팅방 유저이거나 오픈채팅방의 내 계정이면 `true`입니다. */
  isOpenUser(): this is OpenUser | UserSelf {
    return false;
  }

  /** 채팅방에 추가된 챗봇이면 `true`입니다. */
  isBotUser(): this is BotUser {
    return false;
  }

  /** 방장이면 `true`입니다. 역할 정보가 없는 기본 `User`는 `false`입니다. */
  isHost(): boolean {
    return false;
  }

  /** 부방장이면 `true`입니다. 역할 정보가 없는 기본 `User`는 `false`입니다. */
  isModerator(): boolean {
    return false;
  }
}

/** 피드에서 유저를 찾는다. */
export function findFeedMember(data: FeedEvent, userId: string): Member | undefined {
  if (data.author?.id === userId) return data.author;

  const feed = data.feed?.value;
  if (feed?.$case === 'userJoined') {
    const user = feed.userJoined.joinedUsers.find((item) => item.id === userId);
    if (user !== undefined) return { id: user.id, isMine: false, nickname: user.nickname };
  }
  if (feed?.$case === 'userLeft' && feed.userLeft.leftMember?.id === userId) {
    return {
      id: feed.userLeft.leftMember.id,
      isMine: false,
      nickname: feed.userLeft.leftMember.nickname
    };
  }
  if (feed?.$case === 'userKicked') {
    if (feed.userKicked.kickedBy?.id === userId) return feed.userKicked.kickedBy;
    if (feed.userKicked.kickedUser?.id === userId) {
      return {
        id: feed.userKicked.kickedUser.id,
        isMine: false,
        nickname: feed.userKicked.kickedUser.nickname
      };
    }
  }
  if (feed?.$case === 'messageDeleted') return feed.messageDeleted.previousMessage?.author;
  if (feed?.$case === 'messageChanged') return feed.messageChanged.message?.author;
  if (feed?.$case === 'messageHidden') {
    return feed.messageHidden.previousMessages.find((message) => message.author?.id === userId)?.author;
  }
  return undefined;
}
