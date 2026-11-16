/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { ChannelRaw } from '../types/channel.js';
import type { Channel } from '../channel/channel.js';
import type { ClientHelper } from '../client/client-helper.js';
import type {
  Attachment,
  AudioAttachment,
  EmoticonAttachment,
  FileAttachment,
  MapAttachment,
  MessageChatRaw,
  MessageScopeName,
  MiniEmoticonAttachment,
  MultiPhotoAttachment,
  PhotoAttachment,
  ProfileAttachment,
  ReplyAttachment,
  VideoAttachment
} from '../types/chat.js';
import type { User } from '../user/user.js';
import { parseAttachment, parseMapFields } from './attachment.js';
import { Chat } from './chat.js';
import { baseMessageType, MessageKind } from './chat-type.js';

const messageClients = new WeakMap<object, { helper: ClientHelper; channel: Channel }>();

export interface MessageChatInput {
  readonly messageId: string;
  readonly threadId?: string | undefined;
  readonly scope: number;
  readonly messageType: number;
  readonly message: string;
  readonly attachmentJson: string;
  readonly modifyLog: readonly {
    readonly revision: string | number;
    readonly message: string;
  }[];
}

/**
 * 메세지. `message` 이벤트 리스너의 `chat` 인자나 메세지 조회 메서드로 받습니다.
 *
 * 사진, 동영상 같은 종류는 하위 클래스로 받고 `isPhoto()` 같은 메서드로 좁힙니다.
 * 답장은 `chat instanceof ReplyChat`으로 확인합니다.
 */
export class MessageChat extends Chat {
  /** 메세지 로그 ID */
  readonly id: string;

  /** 스레드 ID. 스레드에 속하지 않으면 `null` */
  readonly threadId: string | null;

  /** 받은 메세지 타입 번호. 삭제된 메세지는 삭제 표시(`0x4000`)가 더해져 있습니다. */
  readonly type: number;

  /**
   * `type`에서 삭제 표시(`0x4000`)를 뺀 메세지 타입 번호
   *
   * 1 일반, 2 사진, 3 동영상, 5 음성, 12·20·25 이모티콘, 17 프로필, 18 파일, 26 답장, 27 여러 장의 사진, 100 지도.
   * 카카오맵 공유가 아닌 100과 모르는 번호는 `MessageChat`으로 받습니다.
   */
  readonly originType: number;

  /** 메세지 내용 */
  readonly text: string;

  /** 첨부 데이터. 첨부가 없으면 빈 객체 */
  readonly attachment: Attachment;

  /** 메세지 원본 데이터 */
  readonly raw: MessageChatRaw;

  /** @internal */
  constructor(data: MessageChatInput, user: User | null, channel: ChannelRaw | Channel, helper?: ClientHelper) {
    super(user);

    const attachment = data.attachmentJson ? parseAttachment(data.attachmentJson) : null;

    this.id = data.messageId;
    this.threadId = data.threadId ?? null;
    this.type = data.messageType;
    this.originType = baseMessageType(data.messageType);
    this.text = data.message;
    this.attachment = attachment ?? {};
    const rawChannel = helper === undefined ? channel : (channel as Channel).raw;
    if (helper !== undefined) messageClients.set(this, { helper, channel: channel as Channel });
    this.raw = {
      logId: data.messageId,
      threadId: data.threadId ?? null,
      type: data.messageType,
      scope: toScope(data.scope),
      message: data.message,
      attachment: this.attachment,
      modifyLog: data.modifyLog.map((log) => ({
        revision: Number(log.revision),
        message: log.message
      })),
      user: user?.raw ?? null,
      channel: rawChannel
    };
  }

  override isMessageChat(): this is MessageChat {
    return true;
  }

  /** 첨부 데이터를 원하는 타입으로 가져옵니다. 데이터가 그 타입과 맞는지는 확인하지 않습니다. */
  getAttachment<T extends Attachment = Attachment>(): Partial<T> {
    return this.attachment as Partial<T>;
  }

  /** `text`에서 첫 번째 띄어쓰기 앞부분. 띄어쓰기가 없으면 메세지 전체 */
  get command(): string {
    const index = this.text.indexOf(' ');
    return index === -1 ? this.text : this.text.slice(0, index);
  }

  /** `text`에서 첫 번째 띄어쓰기 뒤의 나머지. 띄어쓰기가 없으면 빈 문자열 */
  get param(): string {
    const index = this.text.indexOf(' ');
    return index === -1 ? '' : this.text.slice(index + 1);
  }

  /** 중복 없이 모은 멘션 유저 목록. 멘션이 없으면 빈 배열 */
  get mentions(): Promise<User[]> {
    const userIds = new Set<string>();
    for (const mention of this.attachment.mentions ?? []) {
      userIds.add(mention.user_id);
    }
    if (userIds.size === 0) return Promise.resolve([]);

    const { helper, channel } = messageClient(this);
    return helper.getUsers(channel, [...userIds]);
  }

  /** 이 메세지를 읽은 유저 목록 */
  get readMembers(): Promise<User[]> {
    const { helper, channel } = messageClient(this);
    return helper.getMessageReaders(channel, this.id, true);
  }

  /** 이 메세지를 읽지 않은 유저 목록 */
  get unreadMembers(): Promise<User[]> {
    const { helper, channel } = messageClient(this);
    return helper.getMessageReaders(channel, this.id, false);
  }

  /**
   * 이 메세지보다 앞의 메세지를 조회합니다. 없으면 `null`
   *
   * @param count 앞으로 갈 개수. 소수점 아래는 버리고, `0`이면 이 메세지를, 음수면 뒤쪽 메세지를 돌려줍니다.
   */
  getPrevChat(count = 1): Promise<MessageChat | null> {
    count = Math.trunc(count);
    if (count === 0) return Promise.resolve(this);

    const { helper, channel } = messageClient(this);
    return helper.getNearbyMessage(channel, this.id, -count);
  }

  /**
   * 이 메세지보다 뒤의 메세지를 조회합니다. 없으면 `null`
   *
   * @param count 뒤로 갈 개수. 소수점 아래는 버리고, `0`이면 이 메세지를, 음수면 앞쪽 메세지를 돌려줍니다.
   */
  getNextChat(count = 1): Promise<MessageChat | null> {
    count = Math.trunc(count);
    if (count === 0) return Promise.resolve(this);

    const { helper, channel } = messageClient(this);
    return helper.getNearbyMessage(channel, this.id, count);
  }

  /**
   * 답장이나 스레드의 원본 메세지를 조회합니다. 답장은 첨부 데이터의 `src_logId`를, 그 밖에는 `threadId`를 씁니다.
   *
   * @throws 원본 메세지 ID가 없을 때
   */
  getSource(): Promise<MessageChat> {
    let logId = this.threadId;
    if (this.originType === MessageKind.reply) {
      logId = String((this.attachment as Partial<ReplyAttachment>).src_logId ?? '');
    }

    if (!logId) throw new Error('원본 메세지가 없습니다.');

    const { helper, channel } = messageClient(this);
    return helper.getMessage(channel, logId);
  }

  /** 일반 메세지 여부 */
  isNormal(): this is NormalChat {
    return false;
  }

  /** 미니 이모티콘이 들어 있는 메세지 여부 */
  isMiniEmoticon(): this is MiniEmoticonChat {
    return false;
  }

  /** 이모티콘 여부 */
  isEmoticon(): this is EmoticonChat {
    return false;
  }

  /** 사진 여부 */
  isPhoto(): this is PhotoChat {
    return false;
  }

  /** 동영상 여부 */
  isVideo(): this is VideoChat {
    return false;
  }

  /** 음성 여부 */
  isAudio(): this is AudioChat {
    return false;
  }

  /** 지도 여부 */
  isMap(): this is MapChat {
    return false;
  }

  /** 프로필 공유 여부 */
  isProfile(): this is ProfileChat {
    return false;
  }

  /** 파일 여부 */
  isFile(): this is FileChat {
    return false;
  }

  /** 여러 장의 사진 여부 */
  isMultiPhoto(): this is MultiPhotoChat {
    return false;
  }

  /**
   * 답장이거나 스레드에 속한 메세지 여부.
   * 타입을 좁히지 않으므로 {@link ReplyChat}인지는 `chat instanceof ReplyChat`으로 확인하세요.
   */
  isReply(): boolean {
    return this.originType === MessageKind.reply || this.threadId !== null;
  }
}

/** 일반 텍스트 메세지 */
export class NormalChat extends MessageChat {
  override isNormal(): this is NormalChat {
    return true;
  }

  /** 외치기 메세지 여부 */
  hasShout(): boolean {
    return this.attachment.shout === true;
  }
}

/** 미니 이모티콘이 들어 있는 메세지 */
export class MiniEmoticonChat extends MessageChat {
  override isMiniEmoticon(): this is MiniEmoticonChat {
    return true;
  }

  /** 미니 이모티콘 정보 */
  get emojis(): MiniEmoticonAttachment {
    return this.attachment.emojis as MiniEmoticonAttachment;
  }
}

/** 사진 메세지 */
export class PhotoChat extends MessageChat {
  override isPhoto(): this is PhotoChat {
    return true;
  }

  /** 사진 정보 */
  get photo(): PhotoAttachment {
    return this.attachment as PhotoAttachment;
  }
}

/** 동영상 메세지 */
export class VideoChat extends MessageChat {
  override isVideo(): this is VideoChat {
    return true;
  }

  /** 동영상 정보 */
  get video(): VideoAttachment {
    return this.attachment as VideoAttachment;
  }
}

/** 음성 메세지 */
export class AudioChat extends MessageChat {
  override isAudio(): this is AudioChat {
    return true;
  }

  /** 음성 정보 */
  get audio(): AudioAttachment {
    return this.attachment as AudioAttachment;
  }
}

/** 이모티콘 메세지 */
export class EmoticonChat extends MessageChat {
  override isEmoticon(): this is EmoticonChat {
    return true;
  }

  /** 이모티콘 정보 */
  get emoticon(): EmoticonAttachment {
    return this.attachment as EmoticonAttachment;
  }
}

/** 지도 메세지 */
export class MapChat extends MessageChat {
  override isMap(): this is MapChat {
    return true;
  }

  /** 지도 정보 */
  get map(): MapAttachment {
    return parseMapFields(this.attachment) as MapAttachment;
  }
}

/** 프로필 공유 메세지 */
export class ProfileChat extends MessageChat {
  override isProfile(): this is ProfileChat {
    return true;
  }

  /** 공유된 프로필 정보 */
  get profile(): ProfileAttachment {
    return this.attachment as ProfileAttachment;
  }
}

/** 파일 메세지 */
export class FileChat extends MessageChat {
  override isFile(): this is FileChat {
    return true;
  }

  /** 파일 정보 */
  get file(): FileAttachment {
    return this.attachment as FileAttachment;
  }
}

/** 답장 메세지. 전용 타입 가드가 없으니 `chat instanceof ReplyChat`으로 확인합니다. */
export class ReplyChat extends MessageChat {
  /** 답장 정보. 답장 대상 메세지는 `src_`로 시작하는 키에 있습니다. */
  get reply(): ReplyAttachment {
    return this.attachment as ReplyAttachment;
  }
}

/** 여러 장의 사진을 묶은 메세지 */
export class MultiPhotoChat extends MessageChat {
  override isMultiPhoto(): this is MultiPhotoChat {
    return true;
  }

  /** 사진 목록 정보 */
  get photoList(): MultiPhotoAttachment {
    return this.attachment as MultiPhotoAttachment;
  }
}

export function createMessage(
  data: MessageChatInput,
  user: User | null,
  channel: ChannelRaw | Channel,
  helper?: ClientHelper
): MessageChat {
  const type = baseMessageType(data.messageType);

  if (type === MessageKind.normal) {
    const chat = new NormalChat(data, user, channel, helper);
    if (chat.attachment.emojis === undefined) return chat;
    return new MiniEmoticonChat(data, user, channel, helper);
  }
  if (type === MessageKind.photo) return new PhotoChat(data, user, channel, helper);
  if (type === MessageKind.video) return new VideoChat(data, user, channel, helper);
  if (type === MessageKind.audio) return new AudioChat(data, user, channel, helper);
  if (type === MessageKind.emoticon || type === MessageKind.animatedEmoticon || type === MessageKind.gifEmoticon) {
    return new EmoticonChat(data, user, channel, helper);
  }
  if (type === MessageKind.map) {
    const chat = new MessageChat(data, user, channel, helper);
    if (parseMapFields(chat.attachment) === null) return chat;
    return new MapChat(data, user, channel, helper);
  }
  if (type === MessageKind.profile) return new ProfileChat(data, user, channel, helper);
  if (type === MessageKind.file) return new FileChat(data, user, channel, helper);
  if (type === MessageKind.reply) return new ReplyChat(data, user, channel, helper);
  if (type === MessageKind.multiPhoto) return new MultiPhotoChat(data, user, channel, helper);
  return new MessageChat(data, user, channel, helper);
}

function toScope(value: number): MessageScopeName {
  if (value === 1) return 'channel';
  if (value === 2) return 'thread';
  if (value === 3) return 'all';
  return 'unknown';
}

function messageClient(chat: object) {
  const client = messageClients.get(chat);
  if (client === undefined) {
    throw new Error('이 메세지에서는 조회할 수 없습니다.');
  }
  return client;
}
