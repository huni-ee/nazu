/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { ArisaGrpc } from '../grpc/arisa-grpc.js';
import type { ClientHelper } from '../client/client-helper.js';
import type { Channel as ChannelData, Member } from '../grpc/generated/arisa.pb.js';
import { GrpcStore } from '../grpc/grpc-store.js';
import type { Store } from '../grpc/store.js';
import type { OpenChannelInfo, OpenChannelType } from '../types/channel.js';
import { OpenUser } from '../user/open-user.js';
import { UserSelf } from '../user/user-self.js';
import { Channel } from './channel.js';

/** 오픈채팅방입니다. */
export class OpenChannel extends Channel {
  /** 오픈채팅방 종류입니다. */
  declare readonly type: OpenChannelType;

  /** @internal 이벤트나 클라이언트가 만든 객체를 쓰세요. */
  constructor(
    id: string,
    type: OpenChannelType,
    grpc: ArisaGrpc,
    name: string | null = null,
    privateName: string | null = null,
    openChannel: OpenChannelInfo | null = null,
    helper?: ClientHelper,
    store?: Store
  ) {
    super(id, type, grpc, name, privateName, openChannel, helper, store);
  }

  /** @internal */
  static async from(grpc: ArisaGrpc, data: ChannelData, helper?: ClientHelper, store?: Store): Promise<OpenChannel> {
    const roomStore = store ?? new GrpcStore(grpc);
    const type = await roomStore.getOpenRoomType(data.id, data.channelType as OpenChannelType);
    return new OpenChannel(
      data.id,
      type,
      grpc,
      data.name ?? null,
      data.privateName ?? null,
      await roomStore.getOpenRoomInfo(data.id),
      helper,
      roomStore
    );
  }

  /**
   * @internal 서버의 멤버 데이터로 유저를 만듭니다.
   *
   * @param member 서버의 멤버 데이터입니다.
   * @param botName 클라이언트에 설정한 봇 이름입니다.
   */
  createUser(member: Member, botName: string | null = null): OpenUser | UserSelf {
    if (member.isMine) return UserSelf.fromOpen(member, botName);
    return OpenUser.from(member);
  }
}
