/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { ArisaGrpc } from '../grpc/arisa-grpc.js';
import type { ClientHelper } from '../client/client-helper.js';
import type { NormalChannelType } from '../types/channel.js';
import type { Channel as ChannelData, Member } from '../grpc/generated/arisa.pb.js';
import { GrpcStore } from '../grpc/grpc-store.js';
import type { Store } from '../grpc/store.js';
import type { NormalMemberType } from '../types/user.js';
import { NormalUser } from '../user/normal-user.js';
import { UserSelf } from '../user/user-self.js';
import { Channel } from './channel.js';

/** 일반 채팅방입니다. 나와의 채팅에서는 `name`이 내 프로필 닉네임입니다. */
export class NormalChannel extends Channel {
  /** 일반 채팅방 종류입니다. */
  declare readonly type: NormalChannelType;

  /** @internal 이벤트나 클라이언트가 만든 객체를 쓰세요. */
  constructor(
    id: string,
    type: NormalChannelType,
    grpc: ArisaGrpc,
    name: string | null = null,
    privateName: string | null = null,
    helper?: ClientHelper,
    store?: Store
  ) {
    const nickname = type === 'MemoChat' ? helper?.getSelfProfile()?.nickname : undefined;
    const channelName = typeof nickname === 'string' && nickname.trim() ? nickname : name;
    super(id, type, grpc, channelName, privateName, null, helper, store);
  }

  /** @internal */
  static async from(grpc: ArisaGrpc, data: ChannelData, helper?: ClientHelper, store?: Store): Promise<NormalChannel> {
    const roomStore = store ?? new GrpcStore(grpc);
    const type = await roomStore.getNormalRoomType(data.id, data.channelType as NormalChannelType);
    return new NormalChannel(data.id, type, grpc, data.name ?? null, data.privateName ?? null, helper, roomStore);
  }

  /**
   * @internal 서버의 멤버 데이터로 유저를 만듭니다. 만든 유저의 `customName`은 친구 정보에서 지정한 이름입니다.
   *
   * @param member 서버의 멤버 데이터입니다.
   * @param memberType 채팅방에서의 멤버 종류입니다.
   * @param botName 클라이언트에 설정한 봇 이름입니다.
   */
  async createUser(
    member: Member,
    memberType: NormalMemberType = 'member',
    botName: string | null = null
  ): Promise<NormalUser | UserSelf> {
    const customName = await this.store.getFriendName(member.id);

    if (member.isMine) {
      return UserSelf.fromNormal(member, botName, memberType, customName);
    }
    return NormalUser.from(member, memberType, customName);
  }
}
