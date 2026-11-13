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
import { parseAttachment } from './attachment.js';
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
 * 메세지입니다. `message` 이벤트 리스너의 `chat` 인자나 메세지 조회 메서드로 받습니다.
 *
 * 사진, 동영상 같은 종류는 하위 클래스로 받습니다. `isPhoto()` 같은 메서드로 확인하면 타입이 좁혀지고,
 * 답장은 `chat instanceof ReplyChat`으로 확인합니다.
 */
export class MessageChat extends Chat {
  /** 메세지 로그 ID입니다. */
  readonly id: string;

  /** 스레드 ID입니다. 스레드에 속하지 않으면 `null`입니다. */
  readonly threadId: string | null;

  /** 받은 메세지 타입 번호입니다. 삭제된 메세지는 삭제 표시(`0x4000`)가 더해져 있습니다. */
  readonly type: number;

  /**
   * `type`에서 삭제 표시(`0x4000`)를 뺀 메세지 타입 번호입니다.
   *
   * 1 일반, 2 사진, 3 동영상, 5 음성, 12·20·25 이모티콘, 16 지도, 17 프로필, 18 파일, 26 답장, 27 여러 장의 사진입니다.
   * 모르는 번호는 `MessageChat`으로 받습니다.
   */
  readonly originType: number;

  /** 메세지 내용입니다. */
  readonly text: string;

  /** 첨부 데이터입니다. 첨부가 없으면 빈 객체입니다. */
  readonly attachment: Attachment;

  /** 메세지 원본 데이터입니다. */
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

  /** 첨부 데이터를 원하는 타입으로 가져옵니다. 실제 데이터가 그 타입과 맞는지는 확인하지 않습니다. */
  getAttachment<T extends Attachment = Attachment>(): Partial<T> {
    return this.attachment as Partial<T>;
  }

  /** `text`에서 첫 번째 띄어쓰기 앞부분입니다. 띄어쓰기가 없으면 메세지 전체입니다. */
  get command(): string {
    const index = this.text.indexOf(' ');
    return index === -1 ? this.text : this.text.slice(0, index);
  }

  /** `text`에서 첫 번째 띄어쓰기 뒤의 나머지입니다. 띄어쓰기가 없으면 빈 문자열입니다. */
  get param(): string {
    const index = this.text.indexOf(' ');
    return index === -1 ? '' : this.text.slice(index + 1);
  }

  /** 멘션된 유저 목록입니다. 같은 유저는 한 번만 들어가고, 멘션이 없으면 빈 배열입니다. */
  get mentions(): Promise<User[]> {
    const userIds = new Set<string>();
    for (const mention of this.attachment.mentions ?? []) {
      userIds.add(mention.user_id);
    }
    if (userIds.size === 0) return Promise.resolve([]);

    const { helper, channel } = messageClient(this);
    return helper.getUsers(channel, [...userIds]);
  }

  /** 이 메세지를 읽은 유저 목록입니다. */
  get readMembers(): Promise<User[]> {
    const { helper, channel } = messageClient(this);
    return helper.getMessageReaders(channel, this.id, true);
  }

  /** 이 메세지를 읽지 않은 유저 목록입니다. */
  get unreadMembers(): Promise<User[]> {
    const { helper, channel } = messageClient(this);
    return helper.getMessageReaders(channel, this.id, false);
  }

  /**
   * 이 메세지보다 앞의 메세지를 조회합니다. 없으면 `null`입니다.
   *
   * @param count 몇 개 앞으로 갈지 정합니다. 소수점 아래는 버리고, `0`이면 이 메세지를, 음수이면 뒤쪽 메세지를 돌려줍니다.
   */
  getPrevChat(count = 1): Promise<MessageChat | null> {
    count = Math.trunc(count);
    if (count === 0) return Promise.resolve(this);

    const { helper, channel } = messageClient(this);
    return helper.getNearbyMessage(channel, this.id, -count);
  }

  /**
   * 이 메세지보다 뒤의 메세지를 조회합니다. 없으면 `null`입니다.
   *
   * @param count 몇 개 뒤로 갈지 정합니다. 소수점 아래는 버리고, `0`이면 이 메세지를, 음수이면 앞쪽 메세지를 돌려줍니다.
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
   * @throws 원본 메세지 ID가 없으면 오류가 납니다.
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

  /** 일반 메세지이면 `true`입니다. `true`이면 타입이 {@link NormalChat}으로 좁혀집니다. */
  isNormal(): this is NormalChat {
    return false;
  }

  /** 미니 이모티콘이 들어 있는 메세지이면 `true`입니다. */
  isMiniEmoticon(): this is MiniEmoticonChat {
    return false;
  }

  /** 이모티콘이면 `true`입니다. */
  isEmoticon(): this is EmoticonChat {
    return false;
  }

  /** 사진이면 `true`입니다. */
  isPhoto(): this is PhotoChat {
    return false;
  }

  /** 동영상이면 `true`입니다. */
  isVideo(): this is VideoChat {
    return false;
  }

  /** 음성이면 `true`입니다. */
  isAudio(): this is AudioChat {
    return false;
  }

  /** 지도이면 `true`입니다. */
  isMap(): this is MapChat {
    return false;
  }

  /** 프로필 공유이면 `true`입니다. */
  isProfile(): this is ProfileChat {
    return false;
  }

  /** 파일이면 `true`입니다. */
  isFile(): this is FileChat {
    return false;
  }

  /** 여러 장의 사진이면 `true`입니다. */
  isMultiPhoto(): this is MultiPhotoChat {
    return false;
  }

  /**
   * 답장이거나 스레드에 속한 메세지이면 `true`입니다.
   * 타입을 좁히지는 않으므로 {@link ReplyChat}인지 확인하려면 `chat instanceof ReplyChat`을 쓰세요.
   */
  isReply(): boolean {
    return this.originType === MessageKind.reply || this.threadId !== null;
  }
}

/** 일반 텍스트 메세지입니다. */
export class NormalChat extends MessageChat {
  override isNormal(): this is NormalChat {
    return true;
  }

  /** 외치기 메세지이면 `true`입니다. */
  hasShout(): boolean {
    return this.attachment.shout === true;
  }
}

/** 미니 이모티콘이 들어 있는 메세지입니다. */
export class MiniEmoticonChat extends MessageChat {
  override isMiniEmoticon(): this is MiniEmoticonChat {
    return true;
  }

  /** 미니 이모티콘 정보입니다. */
  get emojis(): MiniEmoticonAttachment {
    return this.attachment.emojis as MiniEmoticonAttachment;
  }
}

/** 사진 메세지입니다. */
export class PhotoChat extends MessageChat {
  override isPhoto(): this is PhotoChat {
    return true;
  }

  /** 사진 정보입니다. */
  get photo(): PhotoAttachment {
    return this.attachment as PhotoAttachment;
  }
}

/** 동영상 메세지입니다. */
export class VideoChat extends MessageChat {
  override isVideo(): this is VideoChat {
    return true;
  }

  /** 동영상 정보입니다. */
  get video(): VideoAttachment {
    return this.attachment as VideoAttachment;
  }
}

/** 음성 메세지입니다. */
export class AudioChat extends MessageChat {
  override isAudio(): this is AudioChat {
    return true;
  }

  /** 음성 정보입니다. */
  get audio(): AudioAttachment {
    return this.attachment as AudioAttachment;
  }
}

/** 이모티콘 메세지입니다. */
export class EmoticonChat extends MessageChat {
  override isEmoticon(): this is EmoticonChat {
    return true;
  }

  /** 이모티콘 정보입니다. */
  get emoticon(): EmoticonAttachment {
    return this.attachment as EmoticonAttachment;
  }
}

/** 지도 메세지입니다. */
export class MapChat extends MessageChat {
  override isMap(): this is MapChat {
    return true;
  }

  /** 지도 정보입니다. */
  get map(): MapAttachment {
    return this.attachment as MapAttachment;
  }
}

/** 프로필 공유 메세지입니다. */
export class ProfileChat extends MessageChat {
  override isProfile(): this is ProfileChat {
    return true;
  }

  /** 공유된 프로필 정보입니다. */
  get profile(): ProfileAttachment {
    return this.attachment as ProfileAttachment;
  }
}

/** 파일 메세지입니다. */
export class FileChat extends MessageChat {
  override isFile(): this is FileChat {
    return true;
  }

  /** 파일 정보입니다. */
  get file(): FileAttachment {
    return this.attachment as FileAttachment;
  }
}

/** 답장 메세지입니다. 전용 타입 가드가 없으므로 `chat instanceof ReplyChat`으로 확인합니다. */
export class ReplyChat extends MessageChat {
  /** 답장 정보입니다. 답장 대상 메세지는 `src_`로 시작하는 키에 있습니다. */
  get reply(): ReplyAttachment {
    return this.attachment as ReplyAttachment;
  }
}

/** 여러 장의 사진을 묶은 메세지입니다. */
export class MultiPhotoChat extends MessageChat {
  override isMultiPhoto(): this is MultiPhotoChat {
    return true;
  }

  /** 사진 목록 정보입니다. */
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
  if (type === MessageKind.map) return new MapChat(data, user, channel, helper);
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
