/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import {
  type CallOptions,
  Client,
  type ClientReadableStream,
  credentials,
  type MethodDefinition,
  type ServiceError
} from '@grpc/grpc-js';

import {
  ArisaService,
  type ChannelMembers,
  MediaMode,
  type Channel as ChannelData,
  type Credential,
  type DecryptRequest,
  type EnterChannelRequest,
  type Event,
  type GetChannelRequest,
  type GetChannelMembersRequest,
  type GetMessageRequest,
  type GetMessagesRequest,
  type GetUserRequest,
  type GetUsersRequest,
  type MarkReadRequest,
  type Member,
  type RawQueryRequest,
  type ReplyRequest,
  type SendMediaByChunkRequest
} from './generated/arisa.pb.js';
import type { MediaFile, MediaMode as MediaModeName } from '../types/channel.js';
import { JsonUtil } from '../utils/json/index.js';

type RawQueryParam = string | number | boolean | null;

const MEDIA_CHUNK_SIZE = 1024 * 1024;

/** 파일을 조각으로 나눠 보내는 미디어 업로드 스트림 */
export interface MediaUploadStream {
  file(name: string, mime: string, size: number): Promise<void>;
  chunk(data: Buffer): Promise<void>;
  finish(): Promise<void>;
  cancel(): void;
}

export class ArisaGrpc {
  private client: Client;
  private stream: ClientReadableStream<Event> | undefined;
  private closed = false;

  constructor(private readonly target: string) {
    this.client = this.createClient();
  }

  private createClient(): Client {
    return new Client(this.target, credentials.createInsecure(), {
      'grpc.max_receive_message_length': 64 * 1024 * 1024,
      'grpc.max_send_message_length': 64 * 1024 * 1024
    });
  }

  /** Arisa 서버 연결 상태를 확인한다. */
  connect(): Promise<void> {
    if (this.closed) {
      this.client = this.createClient();
      this.closed = false;
    }
    return this.healthCheck();
  }

  /** Arisa 서버의 상태를 확인한다. */
  async healthCheck(): Promise<void> {
    await this.unary(ArisaService.healthCheck, {}, { deadline: Date.now() + 1000 });
  }

  /** 서버 이벤트 스트림을 구독한다. */
  subscribeEvents(): ClientReadableStream<Event> {
    const method = ArisaService.subscribeEvents;
    this.stream = this.client.makeServerStreamRequest(
      method.path,
      method.requestSerialize,
      method.responseDeserialize,
      {}
    );
    return this.stream;
  }

  /** 채널에 메세지를 보낸다. */
  async reply(channelId: string, message: string, threadId?: string | null): Promise<void> {
    const request: ReplyRequest = { channelId, message };
    if (threadId !== undefined && threadId !== null) {
      request.threadId = threadId;
    }

    await this.unary(ArisaService.reply, request);
  }

  /** 채널의 메세지를 읽음 처리한다. */
  async markRead(channelId: string): Promise<void> {
    const request: MarkReadRequest = { channelId };
    await this.unary(ArisaService.markRead, request);
  }

  /** 채널에 입장한다. */
  async enterChannel(channelId: string): Promise<void> {
    const request: EnterChannelRequest = { channelId };
    await this.unary(ArisaService.enterChannel, request);
  }

  /** 미디어 업로드 스트림을 열고, 파일 정보와 조각을 보낼 함수를 돌려준다. */
  openMediaStream(channelId: string, count: number, mode: MediaModeName): MediaUploadStream {
    const method = ArisaService.sendMediaByChunk;
    let resolveDone!: () => void;
    let rejectDone!: (error: Error) => void;
    const done = new Promise<void>((resolve, reject) => {
      resolveDone = resolve;
      rejectDone = reject;
    });
    // HTTP 요청 사이에 원격 오류가 들어올 수 있다.
    void done.catch(() => undefined);
    // 전송이 먼저 끝나면 기다리던 쓰기를 실패시킨다. 쓰기마다 done에 핸들러를 달면
    // 그 핸들러가 조각을 붙잡아 업로드가 끝날 때까지 모든 조각이 메모리에 남는다.
    let closedError: Error | null = null;
    let rejectWrite: ((error: Error) => void) | null = null;
    const close = (error: Error): void => {
      closedError ??= error;
      rejectWrite?.(closedError);
      rejectWrite = null;
    };
    const stream = this.client.makeClientStreamRequest(
      method.path,
      method.requestSerialize,
      method.responseDeserialize,
      (error) => {
        if (error) {
          rejectDone(error);
          close(error);
        } else {
          resolveDone();
          close(new Error('미디어 전송이 예상보다 일찍 종료되었습니다.'));
        }
      }
    );
    stream.on('error', (error) => {
      rejectDone(error);
      close(error);
    });
    let ended = false;
    const write = (message: SendMediaByChunkRequest): Promise<void> =>
      new Promise<void>((resolve, reject) => {
        if (ended) return reject(new Error('이미 종료된 미디어 전송입니다.'));
        if (closedError !== null) return reject(closedError);
        rejectWrite = reject;
        stream.write(message, (error?: Error | null) => {
          if (rejectWrite === reject) rejectWrite = null;
          if (error) reject(error);
          else resolve();
        });
      });
    const metadata = write({
      payload: {
        $case: 'metadata',
        metadata: {
          channelId,
          fileCount: count,
          mode: mode === 'multiple' ? MediaMode.MEDIA_MODE_MULTIPLE : MediaMode.MEDIA_MODE_SINGLE
        }
      }
    });
    void metadata.catch(() => undefined);
    return {
      async file(name, mime, size) {
        await metadata;
        await write({
          payload: {
            $case: 'fileMetadata',
            fileMetadata: { fileName: name, fileSize: String(size), contentType: mime }
          }
        });
      },
      async chunk(data) {
        await metadata;
        await write({ payload: { $case: 'chunk', chunk: data } });
      },
      async finish() {
        await metadata;
        ended = true;
        stream.end();
        await done;
      },
      cancel() {
        ended = true;
        stream.cancel();
      }
    };
  }

  /**
   * 미디어 파일을 여러 조각으로 나누어 보낸다.
   * 파일은 차례대로 하나씩 읽고, 조각마다 전송이 끝난 뒤에 다음 조각을 보내
   * 메모리에는 지금 보내는 파일 하나만 남게 한다.
   */
  async sendMedia(channelId: string, files: readonly (() => Promise<MediaFile>)[], mode: MediaModeName): Promise<void> {
    const upload = this.openMediaStream(channelId, files.length, mode);
    try {
      for (const load of files) {
        const { data, name, mime } = await load();
        await upload.file(name ?? '', mime ?? 'application/octet-stream', data.byteLength);
        for (let offset = 0; offset < data.byteLength; offset += MEDIA_CHUNK_SIZE) {
          const length = Math.min(MEDIA_CHUNK_SIZE, data.byteLength - offset);
          // 조각을 복사하지 않고 원본 메모리를 그대로 가리킨다.
          await upload.chunk(Buffer.from(data.buffer, data.byteOffset + offset, length));
        }
      }
      await upload.finish();
    } catch (error) {
      upload.cancel();
      throw error;
    }
  }

  /** Arisa 인증 정보를 가져온다. */
  getCredential(): Promise<Credential> {
    return this.unary(ArisaService.getCredential, {});
  }

  /** 채널 문맥에 맞는 유저 한 명의 정보를 가져온다. 0은 일반 유저 조회다. */
  getUser(channelId: string, userId: string): Promise<Member> {
    const request: GetUserRequest = { channelId, userId };
    return this.unary(ArisaService.getUser, request);
  }

  /** 채널 유저 정보를 가져온다. */
  async getUsers(channelId: string, userIds: string[]): Promise<Member[]> {
    const request: GetUsersRequest = { channelId, userIds };
    return (await this.unary(ArisaService.getUsers, request)).members;
  }

  /** 메세지 하나를 가져온다. */
  getMessage(channelId: string, logId: string): Promise<Event> {
    const request: GetMessageRequest = { channelId, messageId: logId };
    return this.unary(ArisaService.getMessage, request);
  }

  /** 여러 메세지를 가져온다. */
  async getMessages(channelId: string, logIds: string[]): Promise<Event[]> {
    const request: GetMessagesRequest = { channelId, messageIds: logIds };
    return (await this.unary(ArisaService.getMessages, request)).events;
  }

  /** 채널 정보를 가져온다. */
  getChannel(channelId: string): Promise<ChannelData> {
    const request: GetChannelRequest = { channelId };
    return this.unary(ArisaService.getChannel, request);
  }

  /** 채널 멤버 목록을 가져온다. */
  getChannelMembers(channelId: string): Promise<ChannelMembers> {
    const request: GetChannelMembersRequest = { channelId };
    return this.unary(ArisaService.getChannelMembers, request);
  }

  /** 암호화된 값을 복호화한다. */
  async decrypt(ciphertext: string, enc: number, userId?: string | null): Promise<string> {
    const request: DecryptRequest = { ciphertext, enc };
    if (userId !== undefined && userId !== null) request.userId = userId;
    return (await this.unary(ArisaService.decrypt, request)).plaintext;
  }

  /** Arisa 서버에 SQL 쿼리를 요청한다. */
  async rawQuery(
    sql: string,
    params: readonly RawQueryParam[] = [],
    limit?: number
  ): Promise<Record<string, unknown>[]> {
    const request: RawQueryRequest = {
      sql,
      paramsJson: JSON.stringify(params)
    };
    if (limit !== undefined) request.limit = limit;
    const response = await this.unary(ArisaService.rawQuery, request);
    return response.rowsJson.map((row) => JsonUtil.parseLossless<Record<string, unknown>>(row));
  }

  private unary<Request, Response>(
    method: MethodDefinition<Request, Response>,
    request: Request,
    options?: CallOptions
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const callback = (error: ServiceError | null, response?: Response): void => {
        if (error !== null) reject(error);
        else if (response === undefined) reject(new Error(`${method.path} 응답이 없습니다.`));
        else resolve(response);
      };

      this.client.makeUnaryRequest(
        method.path,
        method.requestSerialize,
        method.responseDeserialize,
        request,
        options ?? {},
        callback
      );
    });
  }

  /** gRPC 연결을 종료한다. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stream?.cancel();
    this.stream = undefined;
    this.client.close();
  }
}
