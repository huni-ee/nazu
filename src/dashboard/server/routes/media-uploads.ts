/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { lookup } from 'mime-types';
import type { MediaUploadStream } from '../../../grpc/arisa-grpc.js';
import { isLongId } from '../../../utils/id/index.js';
import { HttpError, readJsonBody, requireDashboardHeader, sendJson } from '../http.js';
import type { DashboardClient, RouteContext } from '../types.js';
import { hasControlCharacter } from '../validation.js';

const chunkSize = 1024 * 1024;
const expiryMs = 2 * 60 * 1000;
const maxSessions = 16;
const maxFiles = 100;
const maxFileSize = 300 * 1024 * 1024;
const maxTotalSize = 5 * 1024 * 1024 * 1024;
const maxMultipleAudioSize = 10 * 1024 * 1024;
const audioExtension = /\.(?:mp3|wav|flac|tta|tak|aac|wma|ogg|m4a)$/i;
type UploadFile = { name: string; mime: string; size: number };
type Upload = {
  channelId: string;
  accountId: string | null;
  files: UploadFile[];
  stream: MediaUploadStream;
  index: number;
  received: number;
  started: boolean;
  busy: boolean;
  timer: ReturnType<typeof setTimeout>;
};

async function readChunk(request: IncomingMessage): Promise<Buffer> {
  if (!/^application\/octet-stream$/i.test(request.headers['content-type'] ?? '')) {
    request.resume();
    throw new HttpError(415, '파일 데이터 형식이 올바르지 않습니다.');
  }
  const parts: Buffer[] = [];
  let length = 0;
  for await (const part of request) {
    const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part as Uint8Array);
    length += buffer.length;
    if (length > chunkSize) {
      request.resume();
      throw new HttpError(413, '파일 조각이 너무 큽니다.');
    }
    parts.push(buffer);
  }
  if (!length) throw new HttpError(400, '빈 파일 조각은 보낼 수 없습니다.');
  return Buffer.concat(parts, length);
}

/** 브라우저의 조각을 파일 전체를 보관하지 않고 Arisa 스트림으로 전달한다. */
export function createMediaUploadRoute(client: DashboardClient) {
  const sessions = new Map<string, Upload>();
  let closed = false;
  let generation = 0;
  const remove = (id: string, cancel = true): void => {
    const upload = sessions.get(id);
    if (!upload) return;
    sessions.delete(id);
    clearTimeout(upload.timer);
    if (cancel) upload.stream.cancel();
  };
  const refresh = (id: string, upload: Upload): void => {
    if (sessions.get(id) !== upload) throw new HttpError(410, '파일 전송이 취소되었습니다.');
    clearTimeout(upload.timer);
    upload.timer = setTimeout(() => remove(id), expiryMs);
    upload.timer.unref();
  };
  const checkAccount = (id: string, upload: Upload): void => {
    if (sessions.get(id) !== upload) throw new HttpError(410, '파일 전송이 취소되었습니다.');
    if (client.getAccountId() !== upload.accountId) {
      remove(id);
      throw new HttpError(409, '계정이 변경되어 파일 전송이 취소되었습니다.');
    }
  };
  const advance = async (id: string, upload: Upload): Promise<void> => {
    while (upload.index < upload.files.length) {
      checkAccount(id, upload);
      const file = upload.files[upload.index]!;
      if (!upload.started) {
        await upload.stream.file(file.name, file.mime, file.size);
        upload.started = true;
      }
      if (upload.received < file.size) break;
      upload.index++;
      upload.received = 0;
      upload.started = false;
    }
  };
  const handleUpload = async (request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> => {
    const match = /^\/api\/channels\/([1-9]\d*)\/media-uploads(?:\/([a-f0-9]{48})(?:\/(complete|0|[1-9]\d*))?)?$/.exec(
      url.pathname
    );
    if (!match) return false;
    const channelId = match[1]!;
    const id = match[2];
    const operation = match[3];
    if (!isLongId(channelId)) throw new HttpError(400, '채팅방 ID가 올바르지 않습니다.');
    requireDashboardHeader(request);
    if (!id && request.method === 'POST') {
      const startedGeneration = generation;
      const accountId = client.getAccountId();
      const body = await readJsonBody(request, 1024 * 1024);
      if (body.mode !== 'single' && body.mode !== 'multiple')
        throw new HttpError(400, '파일 전송 방식이 올바르지 않습니다.');
      if (
        !Array.isArray(body.files) ||
        !body.files.length ||
        body.files.length > maxFiles ||
        (body.mode === 'single' && body.files.length !== 1)
      )
        throw new HttpError(400, '전송할 파일 목록이 올바르지 않습니다.');
      let total = 0;
      const files: UploadFile[] = body.files.map((item: unknown) => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
          throw new HttpError(400, '파일 정보가 올바르지 않습니다.');
        const file = item as Record<string, unknown>;
        if (
          typeof file.name !== 'string' ||
          !file.name.trim() ||
          file.name.length > 1024 ||
          hasControlCharacter(file.name) ||
          typeof file.size !== 'number' ||
          !Number.isSafeInteger(file.size) ||
          file.size < 0 ||
          (file.mimeType !== undefined &&
            (typeof file.mimeType !== 'string' || file.mimeType.length > 255 || hasControlCharacter(file.mimeType)))
        )
          throw new HttpError(400, '파일 이름 또는 크기가 올바르지 않습니다.');
        if (file.size > maxFileSize) throw new HttpError(413, '파일 하나의 용량을 300MB 이하로 줄여 주세요.');
        if (
          body.mode === 'multiple' &&
          (audioExtension.test(file.name) ||
            (typeof file.mimeType === 'string' && file.mimeType.startsWith('audio/'))) &&
          file.size > maxMultipleAudioSize
        )
          throw new HttpError(413, 'Multiple로 전송하는 오디오 파일은 10MB 이하로 용량을 줄여 주세요.');
        total += file.size;
        return {
          name: file.name,
          size: file.size,
          mime:
            typeof file.mimeType === 'string' && file.mimeType && file.mimeType !== 'application/octet-stream'
              ? file.mimeType
              : lookup(file.name) || 'application/octet-stream'
        };
      });
      if (total > maxTotalSize) throw new HttpError(413, '대시보드 업로드는 파일 전체 합계 최대 5GiB까지 지원합니다.');
      await client.getChannel(channelId);
      if (closed || generation !== startedGeneration) throw new HttpError(503, '대시보드 연결이 종료되었습니다.');
      if (client.getAccountId() !== accountId) throw new HttpError(409, '계정이 변경되어 파일 전송이 취소되었습니다.');
      if (sessions.size >= maxSessions) throw new HttpError(429, '진행 중인 파일 전송이 너무 많습니다.');
      const uploadId = randomBytes(24).toString('hex');
      const upload: Upload = {
        channelId,
        accountId,
        files,
        stream: client.openMediaStream(channelId, files.length, body.mode),
        index: 0,
        received: 0,
        started: false,
        busy: false,
        timer: setTimeout(() => undefined, 0)
      };
      sessions.set(uploadId, upload);
      refresh(uploadId, upload);
      sendJson(response, 200, { uploadId, chunkSize });
      return true;
    }
    if (!id) throw new HttpError(405, '지원하지 않는 요청 방식입니다.');
    const upload = sessions.get(id);
    if (!upload || upload.channelId !== channelId) throw new HttpError(404, '파일 전송을 찾을 수 없습니다.');
    if (request.method === 'DELETE' && !operation) {
      remove(id);
      sendJson(response, 200, { cancelled: true });
      return true;
    }
    if (request.method !== 'POST' || operation === undefined)
      throw new HttpError(405, '지원하지 않는 요청 방식입니다.');
    checkAccount(id, upload);
    if (upload.busy) throw new HttpError(409, '파일 조각을 순서대로 전송하세요.');
    upload.busy = true;
    refresh(id, upload);
    try {
      if (operation === 'complete') {
        await advance(id, upload);
        if (upload.index !== upload.files.length) throw new HttpError(400, '아직 전송하지 않은 파일이 있습니다.');
        checkAccount(id, upload);
        // 조각을 다 받은 뒤에도 Arisa 쪽 업로드가 더 걸릴 수 있다.
        clearTimeout(upload.timer);
        upload.timer = setTimeout(() => remove(id), 15 * 60 * 1000);
        upload.timer.unref();
        await upload.stream.finish();
        remove(id, false);
        sendJson(response, 200, { queued: true, channelId });
      } else {
        const expected = upload.files.findIndex(
          (file, index) =>
            index >= upload.index && (index !== upload.index || upload.received < file.size) && file.size > 0
        );
        if (Number(operation) !== expected) throw new HttpError(409, '파일을 순서대로 전송하세요.');
        const offset = request.headers['x-arisa-upload-offset'];
        const expectedOffset = expected === upload.index ? upload.received : 0;
        if (typeof offset !== 'string' || offset !== String(expectedOffset))
          throw new HttpError(409, '파일 조각 위치가 올바르지 않습니다.');
        const chunk = await readChunk(request);
        checkAccount(id, upload);
        await advance(id, upload);
        checkAccount(id, upload);
        const file = upload.files[upload.index]!;
        if (chunk.length > file.size - upload.received) throw new HttpError(400, '파일 크기가 일치하지 않습니다.');
        await upload.stream.chunk(chunk);
        upload.received += chunk.length;
        refresh(id, upload);
        sendJson(response, 200, { received: upload.received });
      }
    } catch (error) {
      if (sessions.get(id) === upload) remove(id);
      else upload.stream.cancel();
      throw error;
    } finally {
      upload.busy = false;
    }
    return true;
  };
  return {
    cancelAll(): void {
      generation++;
      for (const id of sessions.keys()) remove(id);
    },
    close(): void {
      closed = true;
      generation++;
      for (const id of sessions.keys()) remove(id);
    },
    handle: async ({ request, response, url }: RouteContext): Promise<boolean> => {
      if (!/^\/api\/channels\/[1-9]\d*\/media-uploads(?:\/|$)/.test(url.pathname)) return false;
      try {
        if (await handleUpload(request, response, url)) return true;
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(503, '미디어 전송 요청에 실패했습니다. 채팅방 ID와 Arisa 연결을 확인하세요.');
      }
      throw new HttpError(404, '요청을 찾을 수 없습니다.');
    }
  };
}
