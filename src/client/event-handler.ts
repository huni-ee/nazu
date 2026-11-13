/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import {
  DeleteFeedChat,
  DemoteFeedChat,
  EditFeedChat,
  HandoverFeedChat,
  HideFeedChat,
  InviteFeedChat,
  JoinFeedChat,
  KickFeedChat,
  LeaveFeedChat,
  type MemberTypeChangeFeedChat,
  PromoteFeedChat,
  UnknownFeedChat,
  parseUnknownFeed
} from '../chat/feed.js';
import type {
  Channel as ChannelData,
  Event,
  FeedHostChanged,
  FeedModeratorAdded,
  FeedModeratorRemoved,
  Member,
  MessageEvent
} from '../grpc/generated/arisa.pb.js';
import type { Store } from '../grpc/store.js';
import type { ClientHelper } from './client-helper.js';
import type { Listeners } from './listeners.js';

type MemberFeed =
  | { readonly $case: 'moderatorAdded'; readonly moderatorAdded: FeedModeratorAdded }
  | { readonly $case: 'moderatorRemoved'; readonly moderatorRemoved: FeedModeratorRemoved }
  | { readonly $case: 'hostChanged'; readonly hostChanged: FeedHostChanged };

export class EventHandler {
  constructor(
    private readonly helper: ClientHelper,
    private readonly store: Store,
    private readonly listeners: Listeners
  ) {}

  /** 서버 이벤트를 알맞은 리스너에 전달한다. */
  async handleEvent(event: Event): Promise<void> {
    if (event.value?.$case === 'message') {
      await this.handleMessage(event.value.message);
      return;
    }

    if (event.value?.$case !== 'feed') return;

    const feedEvent = event.value.feed;
    if (feedEvent.channel === undefined) return;

    const feed = feedEvent.feed?.value;
    if (feed === undefined) return;

    if (feed.$case === 'moderatorAdded' || feed.$case === 'moderatorRemoved' || feed.$case === 'hostChanged') {
      await this.handleMemberChange(feedEvent.channel, feedEvent.author, feed);
      return;
    }

    if (feed.$case === 'userLeft') {
      if (!this.listeners.has('leave') && !this.listeners.has('feed')) return;

      const leftMember = feed.userLeft.leftMember;
      if (leftMember === undefined) return;

      const channel = await this.helper.createChannel(feedEvent.channel);

      let leaveInfo: { silent: boolean; kicked: boolean };
      try {
        leaveInfo = await this.store.getLeaveInfo(channel.id, leftMember.id);
      } catch {
        leaveInfo = { silent: false, kicked: false };
      }

      const chat = new LeaveFeedChat(leaveInfo.silent, leaveInfo.kicked, leftMember);
      await this.listeners.emit('feed', chat, channel);
      await this.listeners.emit('leave', chat, channel);
      return;
    }

    if (feed.$case === 'userKicked') {
      if (!this.listeners.has('kick') && !this.listeners.has('feed')) return;

      const kicked = feed.userKicked;
      if (kicked.kickedUser === undefined) return;

      const channel = await this.helper.createChannel(feedEvent.channel);
      const kickedBy = await this.helper.createUser(channel, kicked.kickedBy);
      const chat = new KickFeedChat(kickedBy, kicked.kickedUser);

      await this.listeners.emit('feed', chat, channel);
      await this.listeners.emit('kick', chat, channel);
      return;
    }

    if (feed.$case === 'userJoined') {
      if (!this.listeners.has('join') && !this.listeners.has('invite') && !this.listeners.has('feed')) return;

      const joinedUser = feed.userJoined.joinedUsers[0];
      if (joinedUser === undefined) return;

      const channel = await this.helper.createChannel(feedEvent.channel);

      if (channel.isOpenChannel()) {
        if (!this.listeners.has('join') && !this.listeners.has('feed')) return;

        const chat = new JoinFeedChat(joinedUser);
        await this.listeners.emit('feed', chat, channel);
        await this.listeners.emit('join', chat, channel);
        return;
      }

      if (!channel.isNormalChannel()) return;
      if (!this.listeners.has('invite') && !this.listeners.has('feed')) return;

      const invitedBy = await this.helper.createUser(channel, feedEvent.author);
      const chat = await InviteFeedChat.from(invitedBy, feed.userJoined.joinedUsers, (userIds) =>
        this.helper.getUsers(channel, userIds)
      );
      if (chat === null) return;

      await this.listeners.emit('feed', chat, channel);
      await this.listeners.emit('invite', chat, channel);
      return;
    }

    if (feed.$case === 'messageDeleted') {
      if (!this.listeners.has('delete') && !this.listeners.has('feed')) return;

      const previousMessage = feed.messageDeleted.previousMessage;
      if (previousMessage === undefined) return;

      const channel = await this.helper.createChannel(feedEvent.channel);
      const [user, deletedUser] = await Promise.all([
        this.helper.createUser(channel, feedEvent.author),
        this.helper.createUser(channel, previousMessage.author)
      ]);
      const byHost = channel.isTeamMultiChannel()
        ? await this.store.isHiddenByHost(channel.id, previousMessage.messageId)
        : undefined;
      const chat = new DeleteFeedChat(previousMessage, deletedUser, channel, byHost, this.helper, user);

      await this.listeners.emit('feed', chat, channel);
      await this.listeners.emit('delete', chat, channel);
      return;
    }

    if (feed.$case === 'messageChanged') {
      if (!this.listeners.has('edit') && !this.listeners.has('feed')) return;

      const changed = feed.messageChanged;
      if (changed.message === undefined) return;

      const revision = Number(changed.targetRevision);
      const before = changed.message.modifyLog.find((item) => Number(item.revision) === revision - 1);
      if (before === undefined) return;

      const channel = await this.helper.createChannel(feedEvent.channel);
      const [user, editedUser] = await Promise.all([
        this.helper.createUser(channel, feedEvent.author),
        this.helper.createUser(channel, changed.message.author)
      ]);
      const chat = new EditFeedChat(changed.message, editedUser, channel, before.message, revision, this.helper, user);

      await this.listeners.emit('feed', chat, channel);
      await this.listeners.emit('edit', chat, channel);
      return;
    }

    if (feed.$case === 'messageHidden') {
      if (!this.listeners.has('hide') && !this.listeners.has('feed')) return;

      const hidden = feed.messageHidden;
      const channel = await this.helper.createChannel(feedEvent.channel);
      const hiddenBy = await this.helper.createUser(channel, feedEvent.author);
      const chat = await HideFeedChat.from(hiddenBy, hidden, (member) => this.helper.createUser(channel, member));
      if (chat === null) return;

      await this.listeners.emit('feed', chat, channel);
      await this.listeners.emit('hide', chat, channel);
      return;
    }

    if (feed.$case === 'unknown') {
      if (!this.listeners.has('feed')) return;

      const channel = await this.helper.createChannel(feedEvent.channel);
      const unknown = parseUnknownFeed(feed.unknown.rawJson);
      if (unknown.botUser !== null) {
        await this.listeners.emit('feed', unknown.chat, channel);
        return;
      }

      const user = await this.helper.createUser(channel, feedEvent.author);
      const chat = new UnknownFeedChat(feed.unknown.rawJson, unknown.chat.feedType, unknown.chat.eventType, user);
      await this.listeners.emit('feed', chat, channel);
    }
  }

  /** 이벤트에 대응하는 리스너 이름을 반환한다. */
  eventName(event: Event): string {
    if (event.value?.$case === 'message') return 'message';
    if (event.value?.$case !== 'feed') return 'unknown';

    const type = event.value.feed.feed?.value?.$case;
    if (type === 'userLeft') return 'leave';
    if (type === 'userKicked') return 'kick';
    if (type === 'messageDeleted') return 'delete';
    if (type === 'messageChanged') return 'edit';
    if (type === 'messageHidden') return 'hide';
    if (type === 'hostChanged' || type === 'moderatorAdded' || type === 'moderatorRemoved') {
      return 'member_type_change';
    }
    return 'feed';
  }

  /** 메세지 이벤트를 전달한다. */
  private async handleMessage(message: MessageEvent): Promise<void> {
    if (!this.listeners.has('message') || message.channel === undefined) return;

    const channel = await this.helper.createChannel(message.channel);
    const user = await this.helper.createMessageUser(channel, message);
    const chat = await this.helper.createMessage(message, channel, user);
    await this.listeners.emit('message', chat, channel);
  }

  /** 방장·관리자 변경 이벤트를 전달한다. */
  private async handleMemberChange(
    channelData: ChannelData,
    author: Member | undefined,
    feed: MemberFeed
  ): Promise<void> {
    if (!this.listeners.has('member_type_change') && !this.listeners.has('feed')) return;

    const channel = await this.helper.createChannel(channelData);
    let chat: MemberTypeChangeFeedChat;
    const feedUser = await this.helper.createUser(channel, author);

    if (feed.$case === 'moderatorAdded') {
      const member = feed.moderatorAdded.member;
      if (member === undefined) return;

      chat = new PromoteFeedChat(feedUser, await this.helper.createFeedUser(channel, member));
    } else if (feed.$case === 'moderatorRemoved') {
      const member = feed.moderatorRemoved.member;
      if (member === undefined) return;

      chat = new DemoteFeedChat(feedUser, await this.helper.createFeedUser(channel, member));
    } else {
      const previousHost = feed.hostChanged.previousHost;
      const newHost = feed.hostChanged.newHost;
      if (previousHost === undefined || newHost === undefined) return;

      const [previousHostUser, newHostUser] = await Promise.all([
        this.helper.createFeedUser(channel, previousHost),
        this.helper.createFeedUser(channel, newHost)
      ]);
      chat = new HandoverFeedChat(feedUser, previousHostUser, newHostUser);
    }

    await this.listeners.emit('feed', chat, channel);
    await this.listeners.emit('member_type_change', chat, channel);
  }
}
