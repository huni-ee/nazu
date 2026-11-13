/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { ArisaGrpc } from '../grpc/arisa-grpc.js';
import type { MessageChat } from '../chat/message.js';
import type { ClientHelper } from '../client/client-helper.js';
import { GrpcStore } from '../grpc/grpc-store.js';
import type { Store } from '../grpc/store.js';
import type {
  ChatCount,
  ChatCountOptions,
  ChannelRaw,
  MediaInput,
  OpenChannelInfo,
  SendMediaOptions
} from '../types/channel.js';
import type { User } from '../user/user.js';
import { BotUser } from '../user/bot-user.js';
import type { NormalChannel } from './normal-channel.js';
import type { OpenChannel } from './open-channel.js';
import { prepareMedia } from './media.js';

/**
 * 채팅방입니다. 일반 채팅방은 {@link NormalChannel}, 오픈채팅방은 {@link OpenChannel}로 받습니다.
 *
 * 보통 이벤트 리스너의 `channel` 인자나 `client.getChannel()`로 받으며, 직접 만들 일은 없습니다.
 * `Promise`를 돌려주는 속성은 `await`로 값을 읽습니다.
 */
export class Channel {
  /** 채팅방 ID입니다. */
  readonly id: string;

  /** 채팅방 종류입니다. 값은 {@link NormalChannelType}과 {@link OpenChannelType}을 참고하세요. */
  readonly type: string;

  /** 채팅방 이름입니다. */
  readonly name: string | null;

  /** 채팅방 이름 설정에서 내가 지정한 이름입니다. */
  readonly privateName: string | null;

  /** 오픈채팅방 정보입니다. 일반 채팅방에서는 `null`입니다. */
  readonly openChannel: OpenChannelInfo | null;

  /** 채팅방 원본 데이터입니다. */
  readonly raw: ChannelRaw;
  /** @internal */
  protected readonly grpc: ArisaGrpc;
  /** @internal */
  protected readonly store: Store;
  private readonly helper: ClientHelper | undefined;

  /** @internal 이벤트나 클라이언트가 만든 객체를 쓰세요. */
  constructor(
    id: string,
    type: string,
    grpc: ArisaGrpc,
    name: string | null = null,
    privateName: string | null = null,
    openChannel: OpenChannelInfo | null = null,
    helper?: ClientHelper,
    store?: Store
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.privateName = privateName;
    this.openChannel = openChannel;
    this.grpc = grpc;
    this.store = store ?? new GrpcStore(grpc);
    this.helper = helper;
    this.raw = {
      id,
      type,
      name,
      privateName,
      openChannel
    };
  }

  /**
   * 채팅방에 메세지를 보냅니다.
   *
   * @param message 보낼 메세지입니다.
   * @param threadId 스레드에 보낼 때 그 스레드 ID입니다.
   */
  async send(message: string, threadId?: string | null): Promise<void> {
    await this.grpc.reply(this.id, message, threadId);
  }

  /**
   * 채팅방에 파일을 보냅니다. 파일 경로, URL, 바이트, {@link MediaFile}을 넣을 수 있습니다.
   *
   * 하나를 넣으면 `single`, 배열을 넣으면 `multiple` 방식으로 보냅니다.
   *
   * @param files 보낼 파일이나 파일 목록입니다.
   * @param options 전송 방식입니다.
   * @throws 빈 배열을 넣으면 오류가 납니다.
   */
  async sendMedia(files: MediaInput | MediaInput[], options: SendMediaOptions = {}): Promise<void> {
    const multiple = Array.isArray(files);
    const items = multiple ? files : [files];
    if (items.length === 0) throw new Error('전송할 파일이 없습니다.');

    // 파일을 한꺼번에 읽지 않고, 보낼 차례가 된 파일만 읽는다.
    await this.grpc.sendMedia(
      this.id,
      items.map((item) => () => prepareMedia(item)),
      options.mode ?? (multiple ? 'multiple' : 'single')
    );
  }

  /** 채팅방을 읽음 처리합니다. */
  async read(): Promise<void> {
    await this.grpc.markRead(this.id);
  }

  /** 채팅방에 입장합니다. */
  async enter(): Promise<void> {
    await this.grpc.enterChannel(this.id);
  }

  /**
   * 로그 ID로 메세지를 조회합니다.
   *
   * @param logId 메세지 로그 ID입니다.
   * @throws 클라이언트와 연결되지 않은 채팅방 객체에서 호출하면 오류가 납니다.
   */
  getChat(logId: string): Promise<MessageChat> {
    if (this.helper === undefined) throw new Error('이 채널에서는 조회할 수 없습니다.');
    return this.helper.getMessage(this, logId);
  }

  /**
   * 여러 로그 ID로 메세지를 한꺼번에 조회합니다.
   *
   * @param logIds 메세지 로그 ID 목록입니다.
   * @throws 클라이언트와 연결되지 않은 채팅방 객체에서 호출하면 오류가 납니다.
   */
  getChats(logIds: string[]): Promise<MessageChat[]> {
    if (this.helper === undefined) throw new Error('이 채널에서는 조회할 수 없습니다.');
    return this.helper.getMessages(this, logIds);
  }

  /**
   * 최근 메세지를 조회합니다. 메세지가 없으면 빈 배열을 돌려줍니다.
   *
   * @param count 조회할 메세지 수입니다. 소수점 아래는 버립니다.
   * @throws `count`가 유한한 수가 아니거나, 소수점 아래를 버린 값이 1보다 작으면 오류가 납니다.
   */
  async getRecentChats(count = 1): Promise<MessageChat[]> {
    if (!Number.isFinite(count)) throw new Error('count가 올바르지 않습니다.');

    const limit = Math.floor(count);
    if (limit < 1) throw new Error('count는 1 이상이어야 합니다.');

    const logIds = await this.store.getRecentLogIds(this.id, limit);
    if (logIds.length === 0) return [];

    return this.getChats(logIds);
  }

  /**
   * 기간 안에 유저마다 보낸 채팅 수를 셉니다. 조회되지 않은 유저는 결과에서 빠집니다.
   *
   * @param options 집계 기간과 피드 포함 여부입니다. 생략하면 처음부터 지금까지, 피드 없이 셉니다.
   * @throws 날짜가 올바르지 않거나 `startDate`가 `endDate`보다 늦으면 오류가 납니다.
   */
  async getChatCountsByUser(options: ChatCountOptions = {}): Promise<ChatCount<User>[]> {
    const startDate = options.startDate?.getTime() ?? 0;
    const endDate = options.endDate?.getTime() ?? Date.now();

    if (!Number.isFinite(startDate)) {
      throw new Error('startDate가 올바르지 않습니다.');
    }
    if (!Number.isFinite(endDate)) {
      throw new Error('endDate가 올바르지 않습니다.');
    }
    if (startDate > endDate) {
      throw new Error('startDate는 endDate보다 늦을 수 없습니다.');
    }

    const counts = await this.store.getMessageCounts(
      this.id,
      Math.floor(startDate / 1000),
      Math.ceil(endDate / 1000),
      options.includeFeed === true
    );
    const users = await this.loadUsers(counts.map((item) => item.id));
    const usersById = new Map(users.map((user) => [user.id, user]));

    const result: ChatCount<User>[] = [];
    for (const item of counts) {
      const user = usersById.get(item.id);
      if (user !== undefined) result.push({ user, count: item.count });
    }
    return result;
  }

  /** 지금 채팅방에 있는 멤버의 ID 목록입니다. */
  get memberIds(): Promise<string[]> {
    return this.loadMemberIds();
  }

  /** 지금 채팅방에 있는 멤버 목록입니다. */
  get members(): Promise<User[]> {
    return this.loadMembers();
  }

  /** 방장입니다. 방장이 없는 채팅방이거나 찾지 못하면 `null`입니다. */
  get host(): Promise<User | null> {
    return this.loadHost();
  }

  /** 부방장 목록입니다. 부방장이 없는 채팅방에서는 빈 배열입니다. */
  get moderators(): Promise<User[]> {
    return this.loadModerators();
  }

  /** 채팅방에 추가된 챗봇 목록입니다. */
  get botUsers(): Promise<BotUser[]> {
    return this.loadBotUsers();
  }

  /** 일반 채팅방이면 `true`입니다. `true`이면 타입이 {@link NormalChannel}로 좁혀집니다. */
  isNormalChannel(): this is NormalChannel {
    return (
      this.isMemoChannel() ||
      this.isDirectChannel() ||
      this.isMultiChannel() ||
      this.isTeamMultiChannel() ||
      this.isPlusChannel()
    );
  }

  /** 나와의 채팅(`MemoChat`)이면 `true`입니다. */
  isMemoChannel(): boolean {
    return this.type === 'MemoChat';
  }

  /** 일반 1:1 채팅(`DirectChat`)이면 `true`입니다. */
  isDirectChannel(): boolean {
    return this.type === 'DirectChat';
  }

  /** 일반 그룹 채팅(`MultiChat`)이면 `true`입니다. */
  isMultiChannel(): boolean {
    return this.type === 'MultiChat';
  }

  /** 팀채팅(`TeamMultiChat`)이면 `true`입니다. */
  isTeamMultiChannel(): boolean {
    return this.type === 'TeamMultiChat';
  }

  /** 카카오톡 채널(`PlusChat`)이면 `true`입니다. */
  isPlusChannel(): boolean {
    return this.type === 'PlusChat';
  }

  /** 오픈채팅방이면 `true`입니다. `true`이면 타입이 {@link OpenChannel}로 좁혀집니다. */
  isOpenChannel(): this is OpenChannel {
    return this.isOpenDirectChannel() || this.isOpenMultiChannel() || this.isCommunityOpenMultiChannel();
  }

  /** 1:1 오픈채팅(`OD`)이면 `true`입니다. */
  isOpenDirectChannel(): boolean {
    return this.type === 'OD';
  }

  /** 그룹 오픈채팅(`OM`)이면 `true`입니다. */
  isOpenMultiChannel(): boolean {
    return this.type === 'OM';
  }

  /** 커뮤니티 오픈 그룹 채팅(`COM`)이면 `true`입니다. */
  isCommunityOpenMultiChannel(): boolean {
    return this.type === 'COM';
  }

  private async loadMemberIds(): Promise<string[]> {
    const members = await this.grpc.getChannelMembers(this.id);
    return members.activeMemberIds;
  }

  private loadUsers(userIds: string[]): Promise<User[]> {
    if (this.helper === undefined) throw new Error('이 채널에서는 조회할 수 없습니다.');
    return this.helper.getUsers(this, userIds);
  }

  private async loadMembers(): Promise<User[]> {
    return this.loadUsers(await this.loadMemberIds());
  }

  private async loadHost(): Promise<User | null> {
    if (this.isTeamMultiChannel()) {
      const hostId = await this.store.getTeamHostId(this.id);
      if (hostId === null) return null;
      return (await this.loadUsers([hostId]))[0] ?? null;
    }

    if (!this.isOpenChannel()) return null;
    const users = await this.loadMembers();
    return users.find((user) => user.isHost()) ?? null;
  }

  private async loadModerators(): Promise<User[]> {
    if (this.isTeamMultiChannel()) {
      const moderatorIds = await this.store.getTeamModeratorIds(this.id);
      return this.loadUsers(moderatorIds);
    }

    if (!this.isOpenChannel()) return [];
    const users = await this.loadMembers();
    return users.filter((user) => user.isModerator());
  }

  private async loadBotUsers(): Promise<BotUser[]> {
    const store = this.store;
    const grpc = this.grpc;
    if (!this.isNormalChannel() && !this.isOpenChannel()) return [];

    const botIds = await store.getBotIds(this.id);
    if (botIds.length === 0) return [];

    if (this.isNormalChannel()) {
      const bots = await store.getBotRows(botIds);
      const users: BotUser[] = [];
      for (const botId of botIds) {
        const bot = bots.find((item) => item.id === botId);
        if (bot !== undefined) users.push(new BotUser(botId, bot.name, bot.profileImageUrl));
      }
      return users;
    }

    const members = await grpc.getUsers(this.id, botIds);
    const users: BotUser[] = [];
    for (const botId of botIds) {
      const member = members.find((item) => item.id === botId);
      if (member !== undefined) {
        users.push(new BotUser(member.id, member.nickname, member.profileImageUrl ?? null));
      }
    }
    return users;
  }
}
