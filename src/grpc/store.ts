/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { MessageScope } from './generated/arisa.pb.js';
import type { NormalChannelType, OpenChannelInfo, OpenChannelType } from '../types/channel.js';
import type { OpenProfileChangeUser } from '../types/event.js';

/**
 * 메세지 조회 방향
 */
export type LogDirection = 'before' | 'after';

/**
 * 메세지 데이터
 */
export interface MessageRow {
  readonly userId: string;
  readonly message: string;
  readonly attachmentJson: string;
  readonly threadId?: string;
  readonly scope: MessageScope;
  readonly type: number;
}

/**
 * 퇴장 정보
 */
export interface LeaveInfo {
  readonly silent: boolean;
  readonly kicked: boolean;
}

/**
 * 유저별 채팅 수
 */
export interface MessageCount {
  readonly id: string;
  readonly count: number;
}

/**
 * 봇 정보
 */
export interface NormalBotRow {
  readonly id: string;
  readonly name: string;
  readonly profileImageUrl: string | null;
}

/**
 * 오픈프로필 원본 정보
 */
export interface OpenProfileRow {
  readonly channelId: string;
  readonly userId: string;
  readonly rawName: unknown;
  readonly rawImage: unknown;
  readonly enc: number;
}

export interface Store {
  /**
   * 메세지를 읽은 유저 ID를 조회한다. `read`가 `false`면 읽지 않은 유저를 조회한다.
   */
  getReaderIds(channelId: string, logId: string, read: boolean): Promise<string[]>;

  /**
   * 기준 메세지에서 `direction` 쪽으로 `count`번째 메세지 ID를 조회한다.
   */
  getNearbyLogId(channelId: string, logId: string, count: number, direction: LogDirection): Promise<string | null>;

  /**
   * 저장된 메세지를 복호화해 조회한다.
   */
  getMessageRow(channelId: string, logId: string): Promise<MessageRow>;

  /**
   * 팀채팅에서 방장·부방장이 메세지를 가렸는지 확인한다. 가리기는 삭제 피드로 온다.
   */
  isHiddenByHost(channelId: string, logId: string): Promise<boolean>;

  /**
   * 유저가 조용히 나갔는지, 팀채팅에서 강퇴됐는지 조회한다.
   */
  getLeaveInfo(channelId: string, userId: string): Promise<LeaveInfo>;

  /**
   * 최근 메세지 ID를 조회한다.
   */
  getRecentLogIds(channelId: string, count: number): Promise<string[]>;

  /**
   * 기간 안의 유저별 채팅 수를 조회한다.
   */
  getMessageCounts(
    channelId: string,
    startTime: number,
    endTime: number,
    includeFeed: boolean
  ): Promise<MessageCount[]>;

  /**
   * 채팅방에 추가된 봇 ID를 조회한다.
   */
  getBotIds(channelId: string): Promise<string[]>;

  /**
   * 봇 정보를 조회한다.
   */
  getBotRows(botIds: readonly string[]): Promise<NormalBotRow[]>;

  /**
   * `MultiChat`이 팀채팅이면 `TeamMultiChat`을 돌려준다.
   */
  getNormalRoomType(channelId: string, type: NormalChannelType): Promise<NormalChannelType>;

  /**
   * 팀채팅 방장 ID를 조회한다.
   */
  getTeamHostId(channelId: string): Promise<string | null>;

  /**
   * 팀채팅 부방장 ID를 조회한다.
   */
  getTeamModeratorIds(channelId: string): Promise<string[]>;

  /**
   * 친구 정보에서 내가 지정한 이름을 조회한다.
   */
  getFriendName(userId: string): Promise<string | null>;

  /**
   * `OM`이 커뮤니티면 `COM`을 돌려준다.
   */
  getOpenRoomType(channelId: string, type: OpenChannelType): Promise<OpenChannelType>;

  /**
   * 오픈채팅방 정보를 조회한다.
   */
  getOpenRoomInfo(channelId: string): Promise<OpenChannelInfo | null>;

  /**
   * 저장된 오픈채팅 유저가 속한 채팅방 ID를 찾는다. 지금 참여 중인지는 따지지 않는다.
   */
  getOpenUserChannelId(userId: string): Promise<string | null>;

  /**
   * 오픈프로필 원본 목록을 조회한다.
   */
  getOpenProfiles(): Promise<OpenProfileRow[]>;

  /**
   * 오픈프로필 원본을 복호화한다.
   */
  readOpenProfile(profile: OpenProfileRow): Promise<OpenProfileChangeUser>;
}
