/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { isRecord } from './validation.js';

const maxBodyBytes = 4096;

/** 응답 상태 코드와 화면에 보여 줄 메세지를 담은 오류 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(value));
}

/** 다른 사이트의 폼이나 단순 요청은 이 헤더를 붙일 수 없으므로, 상태를 바꾸는 요청에 요구한다. */
export function requireDashboardHeader(request: IncomingMessage): void {
  if (request.headers['x-arisa-dashboard'] !== '1') throw new HttpError(403, '대시보드 요청 헤더가 필요합니다.');
}

export async function readJsonBody(
  request: IncomingMessage,
  bodyLimit = maxBodyBytes
): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) {
    request.resume();
    throw new HttpError(415, 'Content-Type은 application/json이어야 합니다.');
  }
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > bodyLimit) {
    request.resume();
    throw new HttpError(413, '요청 본문이 너무 큽니다.');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > bodyLimit) {
      tooLarge = true;
      continue;
    }
    chunks.push(chunk);
  }
  if (tooLarge) throw new HttpError(413, '요청 본문이 너무 큽니다.');
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, '올바른 JSON 본문이 아닙니다.');
  }
  if (!isRecord(body)) {
    throw new HttpError(400, '요청 본문이 올바르지 않습니다.');
  }
  return body;
}
