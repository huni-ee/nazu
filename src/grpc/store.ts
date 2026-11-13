/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { MessageScope } from './generated/arisa.pb.js';
import type { NormalChannelType, OpenChannelInfo, OpenChannelType } from '../types/channel.js';
import type { OpenProfileChangeUser } from '../types/event.js';

/** 메세지 조회 방향 */
export type LogDirection = 'before' | 'after';

/** 메세지 데이터 */
export interface MessageRow {
  readonly userId: string;
  readonly message: string;
  readonly attachmentJson: string;
  readonly threadId?: string;
  readonly scope: MessageScope;
  readonly type: number;
}

/** 퇴장 정보 */
export interface LeaveInfo {
  readonly silent: boolean;
  readonly kicked: boolean;
}

/** 채팅 수 */
export interface MessageCount {
  readonly id: string;
  readonly count: number;
}

/** 봇 정보 */
export interface NormalBotRow {
  readonly id: string;
  readonly name: string;
  readonly profileImageUrl: string | null;
}

/** 오픈프로필 정보 */
export interface OpenProfileRow {
  readonly channelId: string;
  readonly userId: string;
  readonly rawName: unknown;
  readonly rawImage: unknown;
  readonly enc: number;
}

export interface Store {
  /** 읽은 유저 아이디를 가져온다. */
  getReaderIds(channelId: string, logId: string, read: boolean): Promise<string[]>;

  /** 이전·다음 메세지 아이디를 가져온다. */
  getNearbyLogId(channelId: string, logId: string, count: number, direction: LogDirection): Promise<string | null>;

  /** 메세지 원본을 가져온다. */
  getMessageRow(channelId: string, logId: string): Promise<MessageRow>;

  /** 팀채팅에서 방장·부방장이 메세지를 가렸는지 확인한다. 가리기는 삭제 피드로 온다. */
  isHiddenByHost(channelId: string, logId: string): Promise<boolean>;

  /** 퇴장 정보를 가져온다. */
  getLeaveInfo(channelId: string, userId: string): Promise<LeaveInfo>;

  /** 최근 메세지 아이디를 가져온다. */
  getRecentLogIds(channelId: string, count: number): Promise<string[]>;

  /** 유저별 채팅 수를 가져온다. */
  getMessageCounts(
    channelId: string,
    startTime: number,
    endTime: number,
    includeFeed: boolean
  ): Promise<MessageCount[]>;

  /** 채널 봇 아이디를 가져온다. */
  getBotIds(channelId: string): Promise<string[]>;

  /** 봇 정보를 가져온다. */
  getBotRows(botIds: readonly string[]): Promise<NormalBotRow[]>;

  /** 일반채팅 종류를 확인한다. */
  getNormalRoomType(channelId: string, type: NormalChannelType): Promise<NormalChannelType>;

  /** 팀채팅 방장 아이디를 가져온다. */
  getTeamHostId(channelId: string): Promise<string | null>;

  /** 팀채팅 관리자 아이디를 가져온다. */
  getTeamModeratorIds(channelId: string): Promise<string[]>;

  /** 친구 이름을 가져온다. */
  getFriendName(userId: string): Promise<string | null>;

  /** 오픈채팅 종류를 확인한다. */
  getOpenRoomType(channelId: string, type: OpenChannelType): Promise<OpenChannelType>;

  /** 오픈채팅방 정보를 가져온다. */
  getOpenRoomInfo(channelId: string): Promise<OpenChannelInfo | null>;

  /** 저장된 오픈채팅 유저 ID에 해당하는 방을 찾는다. */
  getOpenUserChannelId(userId: string): Promise<string | null>;

  /** 오픈프로필 목록을 가져온다. */
  getOpenProfiles(): Promise<OpenProfileRow[]>;

  /** 오픈프로필 정보를 읽는다. */
  readOpenProfile(profile: OpenProfileRow): Promise<OpenProfileChangeUser>;
}
