/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type Database from 'better-sqlite3';
import type { Credential } from '../../api/types.js';
import type { MediaUploadStream } from '../../grpc/arisa-grpc.js';
import type { OpenChannelInfo } from '../../types/channel.js';
import type { MessageChatRaw } from '../../types/chat.js';
import type { UserRaw } from '../../types/user.js';

/** 대시보드에 필요한 채팅방 멤버 정보 */
export interface DashboardMember {
  readonly id: string;
  readonly name: string | null;
  readonly profileImageUrl: string | null;
  isMine(): boolean;
}

/** 홈의 유저 조회에서 사용하는 Nazu 유저 정보 */
export interface DashboardToolUser extends DashboardMember {
  readonly raw: UserRaw & {
    readonly memberType?: string;
    readonly profileType?: string;
    readonly openChannel?: {
      readonly memberType: string;
      readonly profileType: string;
      readonly profileLinkId: string;
    };
  };
  isHost(): boolean;
  isModerator(): boolean;
  isBotUser(): boolean;
}

/** 대시보드에 필요한 채팅방 정보 */
export interface DashboardChannel {
  readonly id: string;
  readonly type: string;
  readonly name: string | null;
  readonly privateName?: string | null;
  readonly openChannel?: OpenChannelInfo | null;
  readonly memberIds: Promise<readonly string[]> | readonly string[];
  readonly members: Promise<readonly DashboardToolUser[]> | readonly DashboardToolUser[];
  getChat(logId: string): Promise<{ readonly raw: MessageChatRaw }>;
  getChats(logIds: string[]): Promise<{ readonly raw: MessageChatRaw }[]>;
  send(message: string, threadId?: string | null): Promise<void>;
  read(): Promise<void>;
  enter(): Promise<void>;
}

/** 오픈 유저 ID로 찾은 방별 프로필과 해당 채팅방. */
export interface DashboardOpenUserContext {
  readonly channel: DashboardChannel;
  readonly user: DashboardToolUser;
}

/** ArisaClient와 대시보드 사이의 연동 인터페이스 */
export interface DashboardBridge {
  readonly target: string;
  readonly botName: string | null;
  isConnected(): boolean;
  isStopped(): boolean;
  isConnecting(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
  healthCheck(): Promise<void>;
  getCredential(): Promise<Credential>;
  getDatabase(): Database.Database;
  getAccountId(): string | null;
  setAccountId(userId: string): void;
  query(
    sql: string,
    params: readonly (string | number | boolean | null)[],
    limit?: number
  ): Promise<Record<string, unknown>[]>;
  decrypt(ciphertext: string, enc: number, userId?: string): Promise<string>;
  getChannel(channelId: string): Promise<DashboardChannel>;
  openMediaStream(channelId: string, count: number, mode: 'single' | 'multiple'): MediaUploadStream;
  getUser(userId: string): Promise<DashboardToolUser>;
  getOpenUser(userId: string): Promise<DashboardOpenUserContext>;
}

/** 내 오픈프로필 */
interface DashboardOpenProfile {
  readonly id: string;
  readonly name: string;
  readonly profileImageUrl: string | null;
  readonly description: string | null;
  readonly tags: readonly string[];
  readonly url: string;
  readonly createdAt: number;
  readonly active: boolean;
  readonly expired: boolean;
}

/** 내 1:1 오픈채팅방 */
interface DashboardDirectOpenChat {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly description: string | null;
  readonly tags: readonly string[];
  readonly url: string;
  readonly createdAt: number;
}

/** 내 그룹·커뮤니티 오픈채팅방 */
interface DashboardOpenChatRoom extends DashboardDirectOpenChat {
  readonly kind: 'community' | 'group';
}

/** 대시보드 요청을 처리하는 조회·저장 인터페이스 */
export interface DashboardClient extends Pick<
  DashboardBridge,
  | 'target'
  | 'botName'
  | 'healthCheck'
  | 'query'
  | 'decrypt'
  | 'getCredential'
  | 'getDatabase'
  | 'getAccountId'
  | 'setAccountId'
  | 'getChannel'
  | 'openMediaStream'
  | 'getUser'
  | 'getOpenUser'
> {
  listChannels(): Promise<DashboardChannel[]>;
  getChannelMemberCounts(): Promise<Map<string, number>>;
  getOwnOpenProfiles(userId: string): Promise<DashboardOpenProfile[]>;
  getOwnOpenProfileChannelLinks(userId: string): Promise<Map<string, string>>;
  getOwnOpenProfileHomeChannelIds(userId: string): Promise<Set<string>>;
  getOwnDirectOpenChats(userId: string): Promise<DashboardDirectOpenChat[]>;
  getOwnDirectOpenChatChannels(userId: string): Promise<{ links: Map<string, string>; homeChannelIds: Set<string> }>;
  getOwnOpenChatRooms(userId: string): Promise<DashboardOpenChatRoom[]>;
}

/** 대시보드 HTTP 요청 하나를 처리하는 데 필요한 값 */
export interface RouteContext {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly url: URL;
  readonly client: DashboardClient;
}

/** 요청을 처리했으면 true, 담당 경로가 아니면 false를 돌려준다. */
export type Route = (context: RouteContext) => Promise<boolean>;
