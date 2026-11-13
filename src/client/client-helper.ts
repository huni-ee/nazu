/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { createMessage as createChat, type MessageChat } from '../chat/message.js';
import { Channel } from '../channel/channel.js';
import { NormalChannel } from '../channel/normal-channel.js';
import { OpenChannel } from '../channel/open-channel.js';
import type { ArisaGrpc } from '../grpc/arisa-grpc.js';
import type { Channel as ChannelData, Event, FeedUser, Member, MessageEvent } from '../grpc/generated/arisa.pb.js';
import type { Store } from '../grpc/store.js';
import type { NormalMemberType, SelfProfile } from '../types/user.js';
import { NormalUser } from '../user/normal-user.js';
import { OpenUser } from '../user/open-user.js';
import { findFeedMember, User } from '../user/user.js';
import { UserSelf } from '../user/user-self.js';

type TeamRoles = readonly [string | null, string[]];

export class ClientHelper {
  constructor(
    private readonly grpc: ArisaGrpc,
    private readonly store: Store,
    private readonly botName: string | null,
    private readonly readProfile: () => SelfProfile | null = () => null
  ) {}

  /** 이 연결에 저장된 내 프로필을 가져온다. */
  getSelfProfile(): SelfProfile | null {
    return this.readProfile();
  }

  /** 채널 아이디로 채널 객체를 만든다. */
  async getChannel(channelId: string): Promise<Channel> {
    return this.createChannel(await this.grpc.getChannel(channelId));
  }

  /** 저장된 방 문맥을 확인해 일반·오픈채팅 유저 정보를 가져온다. */
  async getUser(userId: string): Promise<NormalUser | OpenUser | UserSelf> {
    try {
      return await this.getOpenUser(userId);
    } catch (error) {
      if (error === null || typeof error !== 'object' || !('code' in error) || error.code !== 'OPEN_USER_NOT_FOUND') {
        throw error;
      }
    }
    const member = await this.grpc.getUser('0', userId);
    const customName = await this.store.getFriendName(member.id);
    return member.isMine
      ? UserSelf.fromNormal(member, this.botName, 'member', customName)
      : NormalUser.from(member, 'member', customName);
  }

  /** 중복 요청을 합쳐 ID 순서대로 유저 목록을 가져온다. */
  async getUsersById(userIds: readonly string[]): Promise<(NormalUser | OpenUser | UserSelf)[]> {
    const ids = [...userIds];
    const uniqueIds = [...new Set(ids)];
    const users = new Map<string, NormalUser | OpenUser | UserSelf>();
    for (let index = 0; index < uniqueIds.length; index += 8) {
      const batchIds = uniqueIds.slice(index, index + 8);
      const batch = await Promise.all(batchIds.map(async (id) => [id, await this.getUser(id)] as const));
      for (const [id, user] of batch) users.set(id, user);
    }
    return ids.map((id) => {
      const user = users.get(id);
      if (user === undefined) throw new Error('유저 정보가 없습니다.');
      return user;
    });
  }

  /** 저장된 방 ID로 유저 한 명을 직접 조회한다. */
  private async lookupOpenUser(userId: string): Promise<{ channelId: string; user: OpenUser | UserSelf }> {
    const channelId = await this.store.getOpenUserChannelId(userId);
    if (channelId === null) {
      throw Object.assign(new Error('저장된 오픈채팅 유저 정보를 찾을 수 없습니다.'), { code: 'OPEN_USER_NOT_FOUND' });
    }
    const member = await this.grpc.getUser(channelId, userId);
    if (member.id !== userId) throw new Error('조회한 오픈채팅 유저 ID가 일치하지 않습니다.');
    const user = member.isMine ? UserSelf.fromOpen(member, this.botName) : OpenUser.from(member);
    return { channelId, user };
  }

  /** 채널 객체를 만들지 않고 오픈채팅 유저 정보를 가져온다. */
  async getOpenUser(userId: string): Promise<OpenUser | UserSelf> {
    return (await this.lookupOpenUser(userId)).user;
  }

  /** 조회한 오픈채팅 유저 정보에 해당 방 정보를 함께 반환한다. */
  async getOpenUserContext(userId: string): Promise<{ channel: OpenChannel; user: OpenUser | UserSelf }> {
    const { channelId, user } = await this.lookupOpenUser(userId);
    const channel = await this.getChannel(channelId);
    if (!(channel instanceof OpenChannel)) {
      throw new Error('저장된 오픈채팅방 정보를 확인할 수 없습니다.');
    }
    return { channel, user };
  }

  /** 서버의 채널 데이터를 알맞은 채널 객체로 바꾼다. */
  async createChannel(data: ChannelData): Promise<Channel> {
    if (data.channelType === 'OD' || data.channelType === 'OM' || data.channelType === 'COM') {
      return OpenChannel.from(this.grpc, data, this, this.store);
    }

    if (
      data.channelType === 'MemoChat' ||
      data.channelType === 'DirectChat' ||
      data.channelType === 'MultiChat' ||
      data.channelType === 'TeamMultiChat' ||
      data.channelType === 'PlusChat'
    ) {
      return NormalChannel.from(this.grpc, data, this, this.store);
    }

    return new Channel(
      data.id,
      data.channelType,
      this.grpc,
      data.name ?? null,
      data.privateName ?? null,
      null,
      this,
      this.store
    );
  }

  /** 멤버 데이터를 채널에 맞는 유저 객체로 바꾼다. */
  async createUser(
    channel: Channel,
    member: Member | undefined,
    normalMemberType?: NormalMemberType
  ): Promise<User | null> {
    if (member === undefined) return null;

    if (channel instanceof OpenChannel) {
      if (member.openChannel === undefined) {
        return new User(member.id, member.nickname, member.profileImageUrl ?? null);
      }
      return channel.createUser(member, this.botName);
    }

    if (channel instanceof NormalChannel) {
      let memberType: NormalMemberType = normalMemberType ?? 'member';

      if (channel.isTeamMultiChannel() && normalMemberType === undefined) {
        const [hostId, moderatorIds] = await Promise.all([
          this.store.getTeamHostId(channel.id),
          this.store.getTeamModeratorIds(channel.id)
        ]);
        if (member.id === hostId) memberType = 'host';
        else if (moderatorIds.includes(member.id)) memberType = 'moderator';
      }

      return channel.createUser(member, memberType, this.botName);
    }

    if (member.isMine) return UserSelf.fromNormal(member, this.botName, 'member', null);
    return NormalUser.from(member);
  }

  /** 피드에 들어 있는 유저 정보를 유저 객체로 바꾼다. */
  async createFeedUser(channel: Channel, user: FeedUser): Promise<User> {
    try {
      const member = (await this.grpc.getUsers(channel.id, [user.id]))[0];
      return (await this.createUser(channel, member)) ?? User.fromFeed(user);
    } catch {
      return User.fromFeed(user);
    }
  }

  /** 메세지 데이터와 유저 정보를 메세지 채팅으로 바꾼다. */
  async createMessage(data: MessageEvent, channel: Channel, user?: User | null): Promise<MessageChat> {
    const messageUser = user === undefined ? await this.createMessageUser(channel, data) : user;
    return createChat(data, messageUser, channel, this);
  }

  /** 메세지 작성자 정보를 조회한다. */
  async createMessageUser(channel: Channel, data: MessageEvent): Promise<User | null> {
    if (data.author === undefined) return null;
    return this.createUser(channel, data.author);
  }

  /** 채널 유저 목록을 조회한다. */
  async getUsers(channel: Channel, userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];

    const members = await this.grpc.getUsers(channel.id, userIds);
    const membersById = firstById(members);
    const requestedMembers: Member[] = [];
    for (const userId of userIds) {
      const member = membersById.get(userId);
      if (member !== undefined) requestedMembers.push(member);
    }
    if (requestedMembers.length === 0) return [];

    const teamRoles = channel.isTeamMultiChannel()
      ? await Promise.all([this.store.getTeamHostId(channel.id), this.store.getTeamModeratorIds(channel.id)])
      : null;
    const users: User[] = [];
    for (const member of requestedMembers) {
      let memberType: NormalMemberType | undefined;
      if (teamRoles !== null) {
        if (member.id === teamRoles[0]) memberType = 'host';
        else if (teamRoles[1].includes(member.id)) memberType = 'moderator';
        else memberType = 'member';
      }
      const user = await this.createUser(channel, member, memberType);
      if (user !== null) users.push(user);
    }
    return users;
  }

  /** 메세지 하나를 조회한다. */
  async getMessage(channel: Channel, logId: string): Promise<MessageChat> {
    const event = await this.grpc.getMessage(channel.id, logId);
    return this.readMessageEvent(channel, logId, event);
  }

  /** 여러 메세지를 조회한다. */
  async getMessages(channel: Channel, logIds: string[]): Promise<MessageChat[]> {
    if (logIds.length === 0) return [];

    const events = await this.grpc.getMessages(channel.id, logIds);
    let teamRoles: Promise<TeamRoles> | undefined;
    const getTeamRoles = channel.isTeamMultiChannel()
      ? () =>
          (teamRoles ??= Promise.all([
            this.store.getTeamHostId(channel.id),
            this.store.getTeamModeratorIds(channel.id)
          ]))
      : undefined;
    return Promise.all(
      logIds.map((logId, index) => {
        const event = events[index];
        if (event === undefined) throw new Error('메세지 정보가 없습니다.');
        return this.readMessageEvent(channel, logId, event, getTeamRoles);
      })
    );
  }

  /** 메세지를 읽은 유저 목록을 조회한다. */
  async getMessageReaders(channel: Channel, logId: string, read: boolean): Promise<User[]> {
    const userIds = await this.store.getReaderIds(channel.id, logId, read);
    return this.getUsers(channel, userIds);
  }

  /** 기준 메세지에서 떨어진 위치의 메세지를 조회한다. */
  async getNearbyMessage(channel: Channel, logId: string, offset: number): Promise<MessageChat | null> {
    if (offset === 0) return this.getMessage(channel, logId);

    const nearbyLogId = await this.store.getNearbyLogId(
      channel.id,
      logId,
      Math.abs(offset),
      offset > 0 ? 'after' : 'before'
    );
    return nearbyLogId === null ? null : this.getMessage(channel, nearbyLogId);
  }

  private async readMessageEvent(
    channel: Channel,
    logId: string,
    event: Event,
    getTeamRoles?: () => Promise<TeamRoles>
  ): Promise<MessageChat> {
    if (event.value?.$case === 'message') {
      return this.createMessageWithRoles(event.value.message, channel, getTeamRoles);
    }
    if (event.value?.$case !== 'feed') {
      throw new Error('메세지 정보가 없습니다.');
    }

    const stored = await this.store.getMessageRow(channel.id, logId);
    const feedMember = findFeedMember(event.value.feed, stored.userId);
    let member: Member | undefined;
    try {
      member = (await this.grpc.getUsers(channel.id, [stored.userId]))[0] ?? feedMember;
    } catch {
      member = feedMember;
    }
    const data: MessageEvent = {
      messageId: logId,
      scope: stored.scope,
      messageType: stored.type,
      author: member,
      message: stored.message,
      attachmentJson: stored.attachmentJson,
      modifyLog: [],
      threadId: stored.threadId
    };
    return this.createMessageWithRoles(data, channel, getTeamRoles);
  }

  private async createMessageWithRoles(
    data: MessageEvent,
    channel: Channel,
    getTeamRoles?: () => Promise<TeamRoles>
  ): Promise<MessageChat> {
    if (getTeamRoles === undefined || data.author === undefined) return this.createMessage(data, channel);
    const [hostId, moderatorIds] = await getTeamRoles();
    const memberType =
      data.author.id === hostId ? 'host' : moderatorIds.includes(data.author.id) ? 'moderator' : 'member';
    const user = await this.createUser(channel, data.author, memberType);
    return this.createMessage(data, channel, user);
  }
}

function firstById(members: readonly Member[]): Map<string, Member> {
  const membersById = new Map<string, Member>();
  for (const member of members) {
    if (!membersById.has(member.id)) membersById.set(member.id, member);
  }
  return membersById;
}
