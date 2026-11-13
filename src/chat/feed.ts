/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { BotUser } from '../user/bot-user.js';
import type { Channel } from '../channel/channel.js';
import type { ClientHelper } from '../client/client-helper.js';
import type { ChannelRaw } from '../types/channel.js';
import type { Attachment } from '../types/chat.js';
import type { FeedMessageHidden, FeedUser, Member } from '../grpc/generated/arisa.pb.js';
import { User } from '../user/user.js';
import { JsonUtil } from '../utils/json/index.js';
import { parseAttachment } from './attachment.js';
import { Chat } from './chat.js';
import { FeedKind } from './chat-type.js';
import { MessageChat, type MessageChatInput } from './message.js';

interface HiddenMessagesInput {
  readonly messageIds: readonly string[];
  readonly previousMessages: readonly MessageChatInput[];
}

type UnknownFeedData = {
  readonly feedType?: unknown;
  readonly eventType?: unknown;
  readonly bot?: unknown;
};

/**
 * 입장, 퇴장, 삭제 같은 피드입니다. 종류마다 하위 클래스로 받습니다.
 *
 * `feedType` 값: 1 초대, 2 퇴장, 4 입장, 6 강퇴, 11 부방장 임명, 12 부방장 해제, 14 삭제, 15 방장 위임, 25 수정, 26 가리기.
 * 그 밖의 피드는 {@link UnknownFeedChat}으로 받습니다.
 */
export class FeedChat extends Chat {
  /** 피드 종류 번호입니다. */
  readonly feedType: number;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(feedType: number, user: User | null) {
    super(user);
    this.feedType = feedType;
  }

  override isFeedChat(): this is FeedChat {
    return true;
  }

  /** 따로 처리하지 않는 피드이면 `true`입니다. `true`이면 타입이 {@link UnknownFeedChat}으로 좁혀집니다. */
  isUnknown(): this is UnknownFeedChat {
    return false;
  }
}

/** 일반 채팅방에 유저가 초대된 피드입니다. */
export class InviteFeedChat extends FeedChat {
  declare readonly feedType: typeof FeedKind.invite;

  /** 초대한 유저입니다. 정보가 없으면 `null`입니다. */
  readonly invitedBy: User | null;

  /** 초대된 유저 목록입니다. 한 명 이상 들어 있습니다. */
  readonly invitedUsers: [User, ...User[]];

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(invitedBy: User | null, invitedUsers: [User, ...User[]]) {
    super(FeedKind.invite, invitedBy);
    this.invitedBy = invitedBy;
    this.invitedUsers = invitedUsers;
  }

  /** @internal */
  static async from(
    invitedBy: User | null,
    users: readonly FeedUser[],
    loadUsers: (userIds: string[]) => Promise<User[]>
  ): Promise<InviteFeedChat | null> {
    const invitedUsers = await loadUsers(users.map((user) => user.id));
    if (invitedUsers.length === 0) return null;
    return new InviteFeedChat(invitedBy, [...invitedUsers] as [User, ...User[]]);
  }
}

/** 오픈채팅방에 유저가 들어온 피드입니다. */
export class JoinFeedChat extends FeedChat {
  declare readonly feedType: typeof FeedKind.join;

  /** 들어온 유저입니다. */
  readonly joinedUser: User;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(user: FeedUser) {
    const joinedUser = User.fromFeed(user);
    super(FeedKind.join, joinedUser);
    this.joinedUser = joinedUser;
  }
}

/** 유저가 강퇴된 피드입니다. */
export class KickFeedChat extends FeedChat {
  declare readonly feedType: typeof FeedKind.kick;

  /** 강퇴한 유저입니다. 정보가 없으면 `null`입니다. */
  readonly kickedBy: User | null;

  /** 강퇴된 유저입니다. */
  readonly kickedUser: User;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(kickedBy: User | null, kickedUser: FeedUser) {
    super(FeedKind.kick, kickedBy);
    this.kickedBy = kickedBy;
    this.kickedUser = User.fromFeed(kickedUser);
  }
}

/** 유저가 채팅방을 나간 피드입니다. */
export class LeaveFeedChat extends FeedChat {
  declare readonly feedType: typeof FeedKind.leave;
  /** 나간 유저입니다. */
  readonly leftUser: User;
  private readonly silent: boolean;
  private readonly kicked: boolean;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(silent: boolean, kicked: boolean, user: FeedUser) {
    const leftUser = User.fromFeed(user);
    super(FeedKind.leave, leftUser);
    this.leftUser = leftUser;
    this.silent = silent;
    this.kicked = kicked;
  }

  /** 조용히 나갔으면 `true`입니다. */
  isSilent(): boolean {
    return this.silent;
  }

  /** 강퇴되어 나갔으면 `true`입니다. */
  isKicked(): boolean {
    return this.kicked;
  }
}

/**
 * 부방장 임명·해제와 방장 위임 피드의 부모입니다.
 * 여기서는 아래 속성이 모두 선택적이고, `isPromote()` 같은 메서드로 좁히면 해당 속성이 항상 있습니다.
 */
export class MemberTypeChangeFeedChat extends FeedChat {
  /** 부방장으로 임명된 유저입니다. */
  readonly promotedUser?: User;
  /** 부방장에서 해제된 유저입니다. */
  readonly demotedUser?: User;
  /** 이전 방장입니다. */
  readonly previousHost?: User;
  /** 새 방장입니다. */
  readonly newHost?: User;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(
    feedType: number,
    user: User | null,
    promotedUser?: User,
    demotedUser?: User,
    previousHost?: User,
    newHost?: User
  ) {
    super(feedType, user);
    if (promotedUser !== undefined) this.promotedUser = promotedUser;
    if (demotedUser !== undefined) this.demotedUser = demotedUser;
    if (previousHost !== undefined) this.previousHost = previousHost;
    if (newHost !== undefined) this.newHost = newHost;
  }

  /** 부방장 임명 피드이면 `true`입니다. */
  isPromote(): this is PromoteFeedChat {
    return false;
  }

  /** 부방장 해제 피드이면 `true`입니다. */
  isDemote(): this is DemoteFeedChat {
    return false;
  }

  /** 방장 위임 피드이면 `true`입니다. */
  isHandover(): this is HandoverFeedChat {
    return false;
  }
}

/** 부방장이 임명된 피드입니다. */
export class PromoteFeedChat extends MemberTypeChangeFeedChat {
  declare readonly feedType: typeof FeedKind.promote;

  /** 새 부방장이 된 유저입니다. */
  declare readonly promotedUser: User;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(user: User | null, promotedUser: User) {
    super(FeedKind.promote, user, promotedUser);
  }

  override isPromote(): this is PromoteFeedChat {
    return true;
  }
}

/** 부방장이 해제된 피드입니다. */
export class DemoteFeedChat extends MemberTypeChangeFeedChat {
  declare readonly feedType: typeof FeedKind.demote;

  /** 부방장에서 해제된 유저입니다. */
  declare readonly demotedUser: User;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(user: User | null, demotedUser: User) {
    super(FeedKind.demote, user, undefined, demotedUser);
  }

  override isDemote(): this is DemoteFeedChat {
    return true;
  }
}

/** 방장이 바뀐 피드입니다. */
export class HandoverFeedChat extends MemberTypeChangeFeedChat {
  declare readonly feedType: typeof FeedKind.handover;

  /** 이전 방장입니다. */
  declare readonly previousHost: User;

  /** 새 방장입니다. */
  declare readonly newHost: User;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(user: User | null, previousHost: User, newHost: User) {
    super(FeedKind.handover, user, undefined, undefined, previousHost, newHost);
  }

  override isHandover(): this is HandoverFeedChat {
    return true;
  }
}

/** 삭제된 메세지입니다. */
export class DeletedChat extends MessageChat {
  /**
   * 방장이나 부방장이 가린 메세지이면 `true`입니다.
   * 팀채팅에서는 가리기도 삭제 피드로 오기 때문에 이 값으로 구분합니다. 다른 채팅방에서는 `undefined`입니다.
   */
  declare readonly byHost?: boolean;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(
    data: MessageChatInput,
    user: User | null,
    channel: ChannelRaw | Channel,
    byHost?: boolean,
    helper?: ClientHelper
  ) {
    super(data, user, channel, helper);
    if (byHost !== undefined) this.byHost = byHost;
  }
}

/** 메세지가 삭제된 피드입니다. */
export class DeleteFeedChat extends FeedChat {
  declare readonly feedType: typeof FeedKind.delete;

  /** 삭제한 유저입니다. 정보가 없으면 `null`입니다. */
  readonly deletedBy: User | null;

  /** 삭제된 메세지입니다. */
  readonly deletedChat: DeletedChat;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(
    data: MessageChatInput,
    user: User | null,
    channel: ChannelRaw | Channel,
    byHost?: boolean,
    helper?: ClientHelper,
    deletedBy: User | null = null
  ) {
    super(FeedKind.delete, deletedBy);
    this.deletedBy = deletedBy;
    this.deletedChat = new DeletedChat(data, user, channel, byHost, helper);
  }
}

/** 수정된 메세지입니다. */
export class EditChat extends MessageChat {
  /** 수정 전 내용입니다. */
  readonly beforeText: string;

  /** 수정 후 내용입니다. */
  readonly afterText: string;

  /** 수정 번호입니다. */
  readonly revision: number;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(
    data: MessageChatInput,
    user: User | null,
    channel: ChannelRaw | Channel,
    beforeText: string,
    revision: number,
    helper?: ClientHelper
  ) {
    super(data, user, channel, helper);
    this.beforeText = beforeText;
    this.afterText = data.message;
    this.revision = revision;
  }
}

/** 메세지가 수정된 피드입니다. */
export class EditFeedChat extends FeedChat {
  declare readonly feedType: typeof FeedKind.edit;

  /** 수정한 유저입니다. 정보가 없으면 `null`입니다. */
  readonly editedBy: User | null;

  /** 수정된 메세지입니다. */
  readonly editChat: EditChat;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(
    data: MessageChatInput,
    user: User | null,
    channel: ChannelRaw | Channel,
    beforeText: string,
    revision: number,
    helper?: ClientHelper,
    editedBy: User | null = null
  ) {
    super(FeedKind.edit, editedBy);
    this.editedBy = editedBy;
    this.editChat = new EditChat(data, user, channel, beforeText, revision, helper);
  }
}

/** 가려진 메세지입니다. 원본을 찾지 못하면 `id` 말고는 모두 `null`입니다. */
export class HiddenChat {
  /** 메세지 로그 ID입니다. */
  readonly id: string;

  /** 스레드 ID입니다. */
  readonly threadId: string | null;

  /** 메세지 타입 번호입니다. */
  readonly type: number | null;

  /** 메세지 내용입니다. */
  readonly text: string | null;

  /** 첨부 데이터입니다. */
  readonly attachment: Attachment | null;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(id: string, data?: MessageChatInput) {
    this.id = id;

    if (data === undefined) {
      this.threadId = null;
      this.type = null;
      this.text = null;
      this.attachment = null;
      return;
    }

    const attachment = data.attachmentJson ? parseAttachment(data.attachmentJson) : null;

    this.threadId = data.threadId ?? null;
    this.type = data.messageType;
    this.text = data.message;
    this.attachment = attachment ?? {};
  }
}

/** 방장이나 부방장이 메세지를 가린 피드입니다. */
export class HideFeedChat extends FeedChat {
  declare readonly feedType: typeof FeedKind.hide;

  /** 메세지를 가린 유저입니다. 정보가 없으면 `null`입니다. */
  readonly hiddenBy: User | null;

  /** 가려진 메세지를 보낸 유저 목록입니다. 찾지 못한 유저는 `null`입니다. */
  readonly hiddenUsers: [User | null, ...(User | null)[]];

  /** 가려진 메세지 목록입니다. */
  readonly hiddenChats: HiddenChat[];

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(data: HiddenMessagesInput, hiddenBy: User | null, hiddenUsers: [User | null, ...(User | null)[]]) {
    super(FeedKind.hide, hiddenBy);
    this.hiddenBy = hiddenBy;
    this.hiddenUsers = hiddenUsers;

    const chats = data.messageIds.map((logId) => {
      const message = data.previousMessages.find((item) => item.messageId === logId);
      return new HiddenChat(logId, message);
    });

    this.hiddenChats = chats;
  }

  /** @internal */
  static async from(
    hiddenBy: User | null,
    data: FeedMessageHidden,
    loadUser: (member: Member | undefined) => Promise<User | null>
  ): Promise<HideFeedChat | null> {
    const messages = data.messageIds.map((logId) =>
      data.previousMessages.find((message) => message.messageId === logId)
    );
    if (messages.some((message) => message === undefined)) return null;

    const users = await Promise.all(messages.map((message) => loadUser(message?.author)));
    if (users.length === 0) return null;
    return new HideFeedChat(data, hiddenBy, [...users] as [User | null, ...(User | null)[]]);
  }
}

/** 따로 처리하지 않는 피드입니다. 챗봇 피드도 여기로 옵니다. `feedType`을 읽지 못하면 `-1`입니다. */
export class UnknownFeedChat extends FeedChat {
  /** 피드 원본 JSON 문자열입니다. */
  readonly raw: string;

  /** 이벤트 타입 번호입니다. 읽지 못하면 `null`입니다. */
  readonly eventType: number | null;

  /** @internal 이벤트로 받은 객체를 쓰세요. */
  constructor(rawJson: string, feedType?: number, eventType?: number | null, user: User | null = null) {
    if (feedType === undefined || eventType === undefined) {
      const data = readFeedJson(rawJson);
      if (feedType === undefined) feedType = toNumber(data.feedType) ?? -1;
      if (eventType === undefined) eventType = toNumber(data.eventType);
    }

    super(feedType, user);
    this.raw = rawJson;
    this.eventType = eventType;
  }

  override isUnknown(): this is UnknownFeedChat {
    return true;
  }
}

export function parseUnknownFeed(
  rawJson: string,
  user: User | null = null
): { chat: UnknownFeedChat; botUser: BotUser | null } {
  const data = readFeedJson(rawJson);
  const feedType = toNumber(data.feedType) ?? -1;
  const eventType = toNumber(data.eventType);
  const botUser = feedType === FeedKind.bot ? parseBotUser(data.bot) : null;

  return {
    chat: new UnknownFeedChat(rawJson, feedType, eventType, botUser ?? user),
    botUser
  };
}

function readFeedJson(rawJson: string): UnknownFeedData {
  try {
    const data = JsonUtil.parseLossless<unknown>(rawJson);
    return typeof data === 'object' && data !== null ? data : {};
  } catch {
    return {};
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function parseBotUser(value: unknown): BotUser | null {
  if (typeof value !== 'object' || value === null) return null;

  const bot = value as Record<string, unknown>;
  if (typeof bot.nickName !== 'string') return null;
  if (typeof bot.userId !== 'string' && typeof bot.userId !== 'number') return null;

  return new BotUser(String(bot.userId), bot.nickName, null);
}
