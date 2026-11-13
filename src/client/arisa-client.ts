/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { getSelfProfile, initAuth } from '../api/auth.js';
import type { Channel } from '../channel/channel.js';
import { initDatabase } from '../utils/database/index.js';
import type { DashboardServer } from '../dashboard/server/index.js';
import { ArisaGrpc } from '../grpc/arisa-grpc.js';
import type { Event } from '../grpc/generated/arisa.pb.js';
import { GrpcStore } from '../grpc/grpc-store.js';
import type { ArisaClientOptions } from '../types/client.js';
import type { OpenProfileChange, OpenProfileChangeUser } from '../types/event.js';
import type { NormalUser } from '../user/normal-user.js';
import type { OpenUser } from '../user/open-user.js';
import type { UserSelf } from '../user/user-self.js';
import { ClientHelper } from './client-helper.js';
import { EventHandler } from './event-handler.js';
import { Listeners, type ClientListenerMap } from './listeners.js';
import { OpenProfileWatcher } from './open-profile-watcher.js';
import { isLongId } from '../utils/id/index.js';
import { KakaoLink, type KakaoLinkOptions } from '../kakao-link/index.js';

function validateUserId(value: unknown): asserts value is string {
  if (!isLongId(value)) {
    throw new TypeError('유저 ID는 양의 64비트 정수 문자열로 입력하세요.');
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}초`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return seconds % 60 ? `${minutes}분 ${seconds % 60}초` : `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours}시간 ${minutes % 60}분` : `${hours}시간`;
}

/**
 * Arisa 서버에 연결해 이벤트를 받고, 채팅방과 유저를 조회하는 클라이언트입니다.
 *
 * @example
 * ```ts
 * const client = new ArisaClient();
 * client.on('message', async (chat, channel) => {
 *   if (chat.text === '!ping') await channel.send('pong!');
 * });
 * await client.start();
 * ```
 */
export class ArisaClient {
  /** 연결할 Arisa 서버 주소입니다. */
  readonly target: string;

  /** 이벤트의 `UserSelf`에 표시할 이름입니다. 지정하지 않았으면 `null`입니다. */
  readonly botName: string | null;

  /** 오픈프로필 변경을 확인하는 간격(밀리초)입니다. */
  readonly openProfileIntervalMs: number;

  private readonly dashboardEnabled: boolean;
  private readonly dashboardPort: number;
  private dashboardServer: DashboardServer | null = null;
  private dashboardStartup: Promise<DashboardServer> | null = null;
  private dashboardClosing: Promise<void> | null = null;
  private readonly grpc: ArisaGrpc;
  private readonly listeners: Listeners;
  private readonly helper: ClientHelper;
  private readonly dashboardHelper: ClientHelper;
  private readonly eventHandler: EventHandler;
  private readonly profileWatcher: OpenProfileWatcher;
  private authInitialized = false;
  private accountId: string | null = null;
  private stopped = false;
  private connected = false;
  private connecting = false;
  private running = false;
  private runCompletion: Promise<void> | null = null;
  private startRequest: { promise: Promise<void> } | null = null;
  private cancelReconnect: (() => void) | null = null;
  private disconnectedAt: number | null = null;
  private retrying = false;
  private readonly handleShutdown = (): void => {
    void this.stop();
  };

  /**
   * 클라이언트를 만듭니다. 서버 연결은 `start()`나 `connect()`를 호출할 때 합니다.
   *
   * @param options 클라이언트 옵션입니다.
   */
  constructor(options: ArisaClientOptions = {}) {
    const openProfileIntervalMs = options.openProfileIntervalMs ?? 1500;
    const dashboardPort = options.dashboardPort ?? 3001;

    this.target = options.target?.trim() || '127.0.0.1:3000';
    this.botName = options.botName?.trim() || null;
    this.openProfileIntervalMs = openProfileIntervalMs;
    this.dashboardEnabled = options.dashboard ?? true;
    this.dashboardPort = dashboardPort;

    this.grpc = new ArisaGrpc(this.target);
    const store = new GrpcStore(this.grpc);
    this.listeners = new Listeners();
    const readProfile = () => (this.accountId === null ? null : getSelfProfile(this.accountId));
    this.helper = new ClientHelper(this.grpc, store, this.botName, readProfile);
    this.dashboardHelper = new ClientHelper(this.grpc, store, null, readProfile);
    this.eventHandler = new EventHandler(this.helper, store, this.listeners);
    this.profileWatcher = new OpenProfileWatcher(
      store,
      (beforeUser, afterUser, channelId) => this.emitProfileChange(beforeUser, afterUser, channelId),
      (error) => this.listeners.emitError('open_profile_change', null, error, []),
      this.openProfileIntervalMs
    );
  }

  /**
   * Arisa 서버에 연결하고 로컬 데이터베이스와 인증 정보를 준비합니다. 이벤트 수신은 시작하지 않습니다.
   *
   * 인증 정보 준비에 실패해도 오류 없이 완료됩니다.
   *
   * @throws `stop()`한 클라이언트에서 호출하면 오류가 납니다. 다시 쓰려면 `start()`를 호출하세요.
   */
  async connect(): Promise<void> {
    if (this.stopped) throw new Error('종료된 클라이언트는 start()로 다시 시작하세요.');
    await this.grpc.connect();
    if (this.stopped) return;
    initDatabase();

    if (!this.authInitialized) {
      const credential = await this.grpc.getCredential();
      if (this.stopped) return;
      try {
        const auth = await initAuth(credential);
        if (this.stopped) return;
        this.accountId = auth.raw.user.userId;
        this.authInitialized = true;
      } catch {
        return;
      }
    }
  }

  /** Arisa 서버가 응답하는지 확인합니다. 응답하지 않으면 오류가 납니다. */
  async healthCheck(): Promise<void> {
    await this.grpc.healthCheck();
  }

  /**
   * 채팅방 ID로 채팅방을 조회합니다.
   *
   * @param channelId 채팅방 ID입니다.
   */
  getChannel(channelId: string): Promise<Channel> {
    return this.helper.getChannel(channelId);
  }

  /**
   * 유저 ID로 저장된 일반 채팅 또는 오픈채팅 유저를 조회합니다.
   * 오픈채팅 유저는 저장된 채팅방을 찾아 프로필과 역할까지 조회합니다.
   *
   * @param userId 유저 ID입니다. 큰 정수가 정확하게 유지되도록 문자열로 넘깁니다.
   * @throws {TypeError} `userId`가 양의 64비트 정수 문자열이 아니면 발생합니다.
   */
  async getUser(userId: string): Promise<NormalUser | OpenUser | UserSelf> {
    validateUserId(userId);
    return this.helper.getUser(userId);
  }

  /**
   * 유저 ID 목록으로 유저를 한꺼번에 조회합니다.
   * 같은 ID는 한 번만 조회하고, 결과는 입력과 같은 순서와 중복 위치로 돌려줍니다.
   *
   * @param userIds 유저 ID 목록입니다. 큰 정수는 문자열로 넘깁니다.
   * @throws {TypeError} 배열이 아니거나 올바르지 않은 ID가 있으면 발생합니다.
   */
  async getUsers(userIds: readonly string[]): Promise<(NormalUser | OpenUser | UserSelf)[]> {
    if (!Array.isArray(userIds)) throw new TypeError('유저 ID 목록은 배열로 전달하세요.');
    const ids = Array.from(userIds as readonly unknown[], (id) => {
      validateUserId(id);
      return id;
    });
    return this.helper.getUsersById(ids);
  }

  /**
   * 저장된 오픈채팅 유저 ID로 채팅방을 찾아 프로필과 역할을 조회합니다.
   *
   * @param userId 오픈채팅 유저 ID입니다. 큰 정수는 문자열로 넘깁니다.
   * @throws {TypeError} `userId`가 양의 64비트 정수 문자열이 아니면 발생합니다.
   */
  async getOpenUser(userId: string): Promise<OpenUser | UserSelf> {
    validateUserId(userId);
    return this.helper.getOpenUser(userId);
  }

  /**
   * Arisa 데이터베이스에 SQL을 실행하고 결과 행을 돌려줍니다.
   *
   * @param sql 실행할 SQL입니다.
   * @param params SQL에 바인딩할 값입니다.
   * @param limit 최대 결과 행 수입니다. 생략하면 Arisa 서버 기본값을 씁니다.
   */
  query(
    sql: string,
    params: readonly (string | number | boolean | null)[] = [],
    limit?: number
  ): Promise<Record<string, unknown>[]> {
    return this.grpc.rawQuery(sql, params, limit);
  }

  /**
   * Arisa의 인증 정보로 로그인하는 카카오링크 클라이언트를 만듭니다. 보내기 전에 `init()`을 호출하세요.
   *
   * @param options 카카오링크 앱 키와 웹 도메인입니다.
   */
  kakaoLink(options: KakaoLinkOptions): KakaoLink {
    return new KakaoLink({ getCredential: () => this.grpc.getCredential() }, options);
  }

  /**
   * 서버에 연결하고 이벤트 수신을 시작합니다. 대시보드가 켜져 있으면 함께 시작합니다.
   *
   * 연결이 끊기면 3초마다 다시 연결하고, `SIGINT`나 `SIGTERM`을 받으면 종료합니다.
   * 이벤트를 처음부터 받으려면 호출하기 전에 리스너를 등록하세요.
   *
   * @returns 이벤트 수신이 끝날 때 완료됩니다.
   */
  start(): Promise<void> {
    if (this.startRequest !== null) return this.startRequest.promise;
    if (this.running && !this.stopped) return this.runCompletion ?? Promise.resolve();
    const request = { promise: Promise.resolve() };
    this.startRequest = request;
    request.promise = (async () => {
      try {
        if (this.runCompletion !== null) await this.runCompletion.catch(() => undefined);
        if (this.dashboardClosing !== null) await this.dashboardClosing;
        if (this.startRequest !== request) return;

        this.running = true;
        this.stopped = false;
        this.connecting = true;
        this.dashboardClosing = null;
        this.removeShutdownHandlers();
        process.once('SIGINT', this.handleShutdown);
        process.once('SIGTERM', this.handleShutdown);
        const completion = this.receiveEvents();
        this.runCompletion = completion;
        this.startRequest = null;
        await completion;
      } finally {
        if (this.startRequest === request) this.startRequest = null;
      }
    })();
    return request.promise;
  }

  private async receiveEvents(): Promise<void> {
    try {
      if (this.dashboardEnabled && this.dashboardServer === null) {
        const { startDashboard } = await import('../dashboard/server/index.js');
        if (this.stopped) return;
        this.dashboardStartup = startDashboard(
          {
            target: this.target,
            botName: this.botName,
            isConnected: () => this.connected,
            isStopped: () => this.stopped && this.startRequest === null,
            isConnecting: () => this.connecting || this.startRequest !== null,
            start: () => this.start(),
            stop: () => this.stop({ closeDashboard: false }),
            healthCheck: () => this.healthCheck(),
            getCredential: () => this.grpc.getCredential(),
            getDatabase: () => initDatabase(),
            getAccountId: () => this.accountId,
            setAccountId: (userId) => {
              this.accountId = userId;
            },
            query: (sql, params, limit) => this.query(sql, params, limit),
            decrypt: (ciphertext, enc, userId) => this.grpc.decrypt(ciphertext, enc, userId),
            getUser: (id: string) => this.dashboardHelper.getUser(id),
            getOpenUser: (id: string) => this.dashboardHelper.getOpenUserContext(id),
            getChannel: (id: string) => this.dashboardHelper.getChannel(id),
            openMediaStream: (channelId, count, mode) => this.grpc.openMediaStream(channelId, count, mode)
          },
          this.dashboardPort
        );
        const server = await this.dashboardStartup;
        if (this.dashboardClosing !== null) return;
        this.dashboardServer = server;
      }
      while (!this.stopped) {
        this.connecting = true;
        let reason: string | undefined;
        try {
          await this.connect();
          if (this.stopped) return;
          this.connected = true;
          this.connecting = false;
          if (this.listeners.has('open_profile_change')) this.profileWatcher.start();
          if (this.disconnectedAt === null) this.log('Arisa 서버에 연결되었습니다');
          else this.log(`다시 연결되었습니다 (끊긴 시간 ${formatDuration(Date.now() - this.disconnectedAt)})`);
          this.disconnectedAt = null;
          this.retrying = false;

          const stream = this.grpc.subscribeEvents();
          for await (const value of stream) {
            const event = value as Event;
            if (this.stopped) return;
            try {
              await this.eventHandler.handleEvent(event);
            } catch (error) {
              await this.listeners.emitError(this.eventHandler.eventName(event), null, error, [event]);
            }
          }
        } catch (error) {
          if (this.stopped) return;
          // grpc-js는 내용이 없어도 "Resolution note:"를 끝에 붙인다.
          reason = (error as Error).message.replace(/\.?\s*Resolution note:\s*$/, '');
          if (this.listeners.has('error')) {
            await this.listeners.emitError('connect', null, error, []);
          }
        }

        if (this.stopped) return;
        const wasConnected = this.connected;
        this.connected = false;
        this.connecting = false;
        this.profileWatcher.stop();
        // 끊긴 동안에는 첫 실패만 남기고, 3초마다 같은 로그를 반복하지 않는다.
        const detail = reason ? `: ${reason}` : '';
        if (wasConnected) {
          this.disconnectedAt = Date.now();
          this.log(`연결이 끊겼습니다${detail} (3초마다 다시 시도합니다)`);
        } else if (!this.retrying) {
          this.log(`연결할 수 없습니다${detail} (3초마다 다시 시도합니다)`);
        }
        this.retrying = true;
        await this.waitForReconnect();
      }
    } finally {
      this.connected = false;
      this.connecting = false;
      this.profileWatcher.stop();
      try {
        if (!this.stopped) {
          this.stopped = true;
          this.grpc.close();
          this.removeShutdownHandlers();
          await this.closeDashboard();
        }
      } finally {
        this.running = false;
      }
    }
  }

  /**
   * 이벤트 수신과 연결을 끝냅니다. 끝낸 클라이언트는 `start()`로 다시 시작할 수 있습니다.
   *
   * @param options `closeDashboard`를 `false`로 넘기면 대시보드는 켜 둡니다.
   * @returns 대시보드가 닫히면 완료됩니다. 대시보드를 켜 두면 바로 완료됩니다.
   */
  stop(options: { readonly closeDashboard?: boolean } = {}): Promise<void> {
    const wasActive = !this.stopped || this.startRequest !== null;
    this.startRequest = null;
    this.stopped = true;
    this.connected = false;
    this.connecting = false;
    this.profileWatcher.stop();
    this.grpc.close();
    this.authInitialized = false;
    this.cancelReconnect?.();
    this.disconnectedAt = null;
    this.retrying = false;
    if (wasActive) this.log('연결을 종료했습니다');
    if (options.closeDashboard === false) return Promise.resolve();
    this.removeShutdownHandlers();
    return this.closeDashboard();
  }

  private waitForReconnect(): Promise<void> {
    return new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        this.cancelReconnect = null;
        resolve();
      };
      const timer = setTimeout(finish, 3000);
      this.cancelReconnect = finish;
    });
  }

  private closeDashboard(): Promise<void> {
    if (this.dashboardClosing !== null) return this.dashboardClosing;
    const server = this.dashboardServer;
    const startup = this.dashboardStartup;
    this.dashboardServer = null;
    this.dashboardStartup = null;
    this.dashboardClosing = (async () => {
      const active = server ?? (await startup);
      await active?.close();
    })();
    return this.dashboardClosing;
  }

  /** 클라이언트를 여러 개 띄워도 구분되도록 연결 대상 주소를 앞에 붙인다. */
  private log(message: string): void {
    console.log(`[${this.target}] ${message}`);
  }

  private removeShutdownHandlers(): void {
    process.off('SIGINT', this.handleShutdown);
    process.off('SIGTERM', this.handleShutdown);
  }

  /**
   * 이벤트 리스너를 등록합니다. 연결된 상태에서 `open_profile_change`를 등록하면 프로필 확인을 시작합니다.
   *
   * @param event 이벤트 이름입니다.
   * @param listener 이벤트에 맞는 인자를 받는 리스너입니다.
   * @returns 클라이언트 자신을 돌려주므로 이어서 호출할 수 있습니다.
   */
  on<Name extends keyof ClientListenerMap>(event: Name, listener: ClientListenerMap[Name]): this {
    this.listeners.on(event, listener);
    if (event === 'open_profile_change' && this.connected) {
      this.profileWatcher.start();
    }
    return this;
  }

  /**
   * 이벤트 리스너를 해제합니다. 마지막 `open_profile_change` 리스너를 해제하면 프로필 확인을 멈춥니다.
   *
   * @param event 이벤트 이름입니다.
   * @param listener 등록할 때 넘긴 함수와 같은 함수입니다.
   * @returns 클라이언트 자신입니다.
   */
  off<Name extends keyof ClientListenerMap>(event: Name, listener: ClientListenerMap[Name]): this {
    this.listeners.off(event, listener);
    if (event === 'open_profile_change' && !this.listeners.has('open_profile_change')) {
      this.profileWatcher.stop();
    }
    return this;
  }

  private async emitProfileChange(
    beforeUser: OpenProfileChangeUser,
    afterUser: OpenProfileChangeUser,
    channelId: string
  ): Promise<void> {
    const channel = await this.helper.getChannel(channelId);
    const nicknameChanged = beforeUser.name !== afterUser.name;
    const profileImageChanged = beforeUser.profileImageUrl !== afterUser.profileImageUrl;
    const change: OpenProfileChange = {
      isNickname: () => nicknameChanged,
      isProfileImage: () => profileImageChanged
    };
    await this.listeners.emit('open_profile_change', beforeUser, afterUser, channel, change);
  }
}
