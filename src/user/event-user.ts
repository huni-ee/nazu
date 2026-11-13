/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { FeedMessageHidden, FeedUser, Member } from '../grpc/generated/arisa.pb.js';

import { User } from './user.js';

/** 메세지를 삭제한 유저를 담는 객체입니다. `User`를 상속하지 않습니다. */
export class DeleteUser {
  /** 삭제한 유저입니다. 정보가 없으면 `null`입니다. */
  readonly deletedBy: User | null;

  constructor(deletedBy: User | null) {
    this.deletedBy = deletedBy;
  }
}

/** 메세지를 수정한 유저를 담는 객체입니다. `User`를 상속하지 않습니다. */
export class EditUser {
  /** 수정한 유저입니다. 정보가 없으면 `null`입니다. */
  readonly editedBy: User | null;

  constructor(editedBy: User | null) {
    this.editedBy = editedBy;
  }
}

/** 오픈채팅방에 들어온 유저를 담는 객체입니다. `User`를 상속하지 않습니다. */
export class JoinUser {
  /** 들어온 유저입니다. */
  readonly joinedUser: User;

  /** @internal */
  constructor(user: FeedUser) {
    this.joinedUser = User.fromFeed(user);
  }
}

/** 채팅방을 나간 유저를 담는 객체입니다. `User`를 상속하지 않습니다. */
export class LeaveUser {
  /** 나간 유저입니다. */
  readonly leftUser: User;

  /** @internal */
  constructor(user: FeedUser) {
    this.leftUser = User.fromFeed(user);
  }
}

/** 강퇴한 유저와 강퇴된 유저를 담는 객체입니다. `User`를 상속하지 않습니다. */
export class KickUser {
  /** 강퇴한 유저입니다. 정보가 없으면 `null`입니다. */
  readonly kickedBy: User | null;
  /** 강퇴된 유저입니다. */
  readonly kickedUser: User;

  /** @internal */
  constructor(kickedBy: User | null, kickedUser: FeedUser) {
    this.kickedBy = kickedBy;
    this.kickedUser = User.fromFeed(kickedUser);
  }
}

/** 초대한 유저와 초대된 유저를 담는 객체입니다. `User`를 상속하지 않습니다. */
export class InviteUser {
  /** 초대한 유저입니다. 정보가 없으면 `null`입니다. */
  readonly invitedBy: User | null;
  /** 초대된 유저 목록입니다. 한 명 이상 들어 있습니다. */
  readonly invitedUsers: [User, ...User[]];

  constructor(invitedBy: User | null, invitedUsers: [User, ...User[]]) {
    this.invitedBy = invitedBy;
    this.invitedUsers = invitedUsers;
  }

  /** @internal */
  static async from(
    invitedBy: User | null,
    users: readonly FeedUser[],
    loadUsers: (userIds: string[]) => Promise<User[]>
  ): Promise<InviteUser | null> {
    const invitedUsers = await loadUsers(users.map((user) => user.id));
    if (invitedUsers.length === 0) return null;
    return new InviteUser(invitedBy, [...invitedUsers] as [User, ...User[]]);
  }
}

/** 메세지를 가린 유저와 가려진 메세지의 작성자를 담는 객체입니다. `User`를 상속하지 않습니다. */
export class HideUser {
  /** 메세지를 가린 유저입니다. 정보가 없으면 `null`입니다. */
  readonly hiddenBy: User | null;
  /** 가려진 메세지를 보낸 유저 목록입니다. 찾지 못한 유저는 `null`입니다. */
  readonly hiddenUsers: [User | null, ...(User | null)[]];

  constructor(hiddenBy: User | null, hiddenUsers: [User | null, ...(User | null)[]]) {
    this.hiddenBy = hiddenBy;
    this.hiddenUsers = hiddenUsers;
  }

  /** @internal */
  static async from(
    hiddenBy: User | null,
    data: FeedMessageHidden,
    loadUser: (member: Member | undefined) => Promise<User | null>
  ): Promise<HideUser | null> {
    const messages = data.messageIds.map((logId) =>
      data.previousMessages.find((message) => message.messageId === logId)
    );
    if (messages.some((message) => message === undefined)) return null;

    const users = await Promise.all(messages.map((message) => loadUser(message?.author)));
    if (users.length === 0) return null;
    return new HideUser(hiddenBy, [...users] as [User | null, ...(User | null)[]]);
  }
}

/** 부방장 임명·해제나 방장 위임에 관련된 유저를 담는 객체입니다. `User`를 상속하지 않습니다. */
export class MemberTypeChangeUser {
  /**
   * @param promotedUser 부방장으로 임명된 유저입니다.
   * @param demotedUser 부방장에서 해제된 유저입니다.
   * @param previousHost 이전 방장입니다.
   * @param newHost 새 방장입니다.
   */
  private constructor(
    readonly promotedUser?: User,
    readonly demotedUser?: User,
    readonly previousHost?: User,
    readonly newHost?: User
  ) {}

  /** 부방장으로 임명된 유저 정보를 만듭니다. */
  static promote(user: User): MemberTypeChangeUser {
    return new MemberTypeChangeUser(user);
  }

  /** 부방장에서 해제된 유저 정보를 만듭니다. */
  static demote(user: User): MemberTypeChangeUser {
    return new MemberTypeChangeUser(undefined, user);
  }

  /** 이전 방장과 새 방장 정보를 만듭니다. */
  static handover(previousHost: User, newHost: User): MemberTypeChangeUser {
    return new MemberTypeChangeUser(undefined, undefined, previousHost, newHost);
  }
}
