/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError, sendJson } from './http.js';
import {
  createFriendRoute,
  createMediaUploadRoute,
  handleChannelRoute,
  handleMeRoute,
  handleRoleRoute,
  handleStaticRoute,
  handleToolRoute
} from './routes/index.js';
import type { DashboardClient, Route } from './types.js';

const contentSecurityPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' https: http: data:; media-src 'self' https: http:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  client: DashboardClient,
  origin: string,
  routes: readonly Route[]
): Promise<void> {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', contentSecurityPolicy);
  if (
    request.headers.host !== new URL(origin).host ||
    (request.headers.origin !== undefined && request.headers.origin !== origin)
  ) {
    throw new HttpError(403, '대시보드 주소에서만 접근할 수 있습니다.');
  }
  const url = new URL(request.url ?? '/', origin);
  if (url.origin !== origin) throw new HttpError(403, '대시보드 주소에서만 접근할 수 있습니다.');
  const context = { request, response, url, client };
  for (const route of routes) {
    if (await route(context)) return;
  }
  response.writeHead(404);
  response.end();
}

/** 대시보드 API와 정적 화면 파일의 요청을 처리한다. */
export function createDashboardHandler(client: DashboardClient) {
  const mediaUploads = createMediaUploadRoute(client);
  const routes: Route[] = [
    mediaUploads.handle,
    handleChannelRoute,
    handleToolRoute,
    handleMeRoute,
    createFriendRoute(),
    handleRoleRoute,
    handleStaticRoute
  ];
  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const origin = 'http://' + request.headers.host;
    try {
      await handleRequest(request, response, client, origin, routes);
    } catch (error) {
      if (response.headersSent) {
        response.end();
        return;
      }
      sendJson(response, error instanceof HttpError ? error.status : 500, {
        error: error instanceof HttpError ? error.message : '요청을 처리하지 못했습니다.'
      });
    }
  };
  return Object.assign(handle, {
    cancelUploads: () => mediaUploads.cancelAll(),
    close: () => mediaUploads.close()
  });
}
