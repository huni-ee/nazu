/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createClientAdapter } from './client-adapter.js';
import { createDashboardHandler } from './handler.js';
import { HttpError, readJsonBody, requireDashboardHeader, sendJson } from './http.js';
import { readSelfProfile } from './self-profile.js';
import type { DashboardBridge } from './types.js';

export interface DashboardServer {
  close(): Promise<void>;
}

interface DashboardEntry {
  readonly id: string;
  readonly bridge: DashboardBridge;
  readonly handleRequest: ReturnType<typeof createDashboardHandler>;
  activeRequests: number;
  drained?: Promise<void>;
  resolveDrained?: () => void;
}

interface DashboardHost {
  readonly server: Server;
  readonly entries: Map<string, DashboardEntry>;
  readonly ready: Promise<void>;
  listeningPort: number;
  closing?: Promise<void>;
}

// 터미널에서는 ┃를 흐리게 출력한다.
const bar = process.stdout.isTTY === true && !('NO_COLOR' in process.env) ? '\x1b[2m┃\x1b[22m' : '┃';

// 포트 0은 독립 서버를 만들고, 명시한 포트는 이 프로세스에서만 공유한다.
const hosts = new Map<number, DashboardHost>();

function connectionId(target: string): string {
  return createHash('sha256')
    .update(target?.trim() ?? '')
    .digest('hex');
}

function firstEntry(host: DashboardHost): DashboardEntry | undefined {
  return host.entries.values().next().value;
}

function publicProfile(entry: DashboardEntry): ReturnType<typeof readSelfProfile> {
  try {
    return readSelfProfile(entry.bridge.getAccountId(), entry.bridge.getDatabase());
  } catch {
    // 아직 DB가 준비되지 않은 연결도 목록과 연결 상태를 확인할 수 있다.
    return null;
  }
}

function publicConnection(entry: DashboardEntry) {
  return {
    id: entry.id,
    target: entry.bridge.target,
    botName: entry.bridge.botName,
    connected: entry.bridge.isConnected(),
    stopped: entry.bridge.isStopped(),
    connecting: entry.bridge.isConnecting(),
    me: publicProfile(entry)
  };
}

/** 다른 도메인을 127.0.0.1로 돌려 접근하는 DNS 리바인딩을 막는다. */
function isLocalHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const { hostname } = new URL(`http://${value}`);
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return false;
  }
}

async function serve(host: DashboardHost, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    if (!isLocalHost(request.headers.host)) return sendJson(response, 403, { error: '허용되지 않은 요청입니다.' });
    const url = new URL(request.url ?? '/', 'http://localhost');
    const isApi = url.pathname.startsWith('/api/');
    if (isApi && request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)
      return sendJson(response, 403, { error: '허용되지 않은 요청입니다.' });

    if (request.method === 'GET' && url.pathname === '/api/connections') {
      return sendJson(response, 200, {
        connections: [...host.entries.values()].map(publicConnection),
        defaultConnectionId: firstEntry(host)?.id ?? null
      });
    }

    const connectionAction = /^\/api\/connections\/([a-f0-9]{64})\/(connect|disconnect)$/.exec(url.pathname);
    const selection = connectionAction?.[1] ?? (isApi ? request.headers['x-arisa-connection'] : undefined);
    const entry =
      selection === undefined
        ? firstEntry(host)
        : typeof selection === 'string'
          ? host.entries.get(selection)
          : undefined;
    if (entry === undefined)
      return sendJson(response, 404, { error: '선택한 Arisa 연결을 찾을 수 없습니다.', code: 'CONNECTION_NOT_FOUND' });

    if (isApi) {
      if (request.method === 'POST' && connectionAction !== null) {
        entry.activeRequests += 1;
        try {
          requireDashboardHeader(request);
          await readJsonBody(request);
          if (connectionAction[2] === 'disconnect') {
            entry.handleRequest.cancelUploads();
            await entry.bridge.stop();
          } else if (entry.bridge.isStopped()) {
            void entry.bridge.start().catch((error) => {
              console.error('Arisa 서버 연결을 시작하지 못했습니다:', error);
            });
          }
          return sendJson(response, 200, publicConnection(entry));
        } finally {
          entry.activeRequests -= 1;
          if (entry.activeRequests === 0) entry.resolveDrained?.();
        }
      }
      if (url.pathname === '/api/tools/health' && entry.bridge.isStopped())
        return sendJson(response, 503, {
          error: '연결이 종료되었습니다. 다시 연결해 주세요.',
          code: 'ARISA_DISCONNECTED'
        });
      if (
        /^\/api\/(friends|channels|me\/(profile|posts)|tools\/(channel|user|users|query|messages|decrypt))(\/|$)/.test(
          url.pathname
        ) &&
        !entry.bridge.isConnected()
      )
        return sendJson(response, 503, {
          error: 'Arisa 서버에 연결될 때까지 기다려 주세요.',
          code: 'ARISA_DISCONNECTED'
        });
      if (request.method === 'GET' && url.pathname === '/api/status') {
        return sendJson(response, 200, {
          target: entry.bridge.target,
          botName: entry.bridge.botName,
          connected: entry.bridge.isConnected(),
          stopped: entry.bridge.isStopped(),
          connecting: entry.bridge.isConnecting(),
          port: host.listeningPort,
          connectionId: entry.id
        });
      }
    }

    entry.activeRequests += 1;
    try {
      await entry.handleRequest(request, response);
    } finally {
      entry.activeRequests -= 1;
      if (entry.activeRequests === 0) entry.resolveDrained?.();
    }
  } catch (error) {
    if (!response.headersSent)
      sendJson(response, error instanceof HttpError ? error.status : 502, {
        error: error instanceof Error && error.message ? error.message : '요청 처리 중 오류가 발생했습니다.'
      });
    else response.end();
  }
}

function createHost(port: number): DashboardHost {
  const server = createServer((request, response) => {
    // 요청 본문 수신에 걸리는 시간을 제한한다.
    const timer = setTimeout(() => {
      if (request.complete || response.destroyed || response.writableEnded) return;
      response.writeHead(408, { Connection: 'close' });
      response.once('finish', () => request.destroy());
      response.end();
    }, 15_000);
    timer.unref();
    const clearTimer = (): void => clearTimeout(timer);
    request.once('end', clearTimer);
    request.once('close', clearTimer);
    response.once('close', clearTimer);
    void serve(host, request, response);
  });
  // Node의 전역 본문 수신 제한 대신 위에서 요청별 제한을 적용한다.
  server.requestTimeout = 0;
  const host: DashboardHost = {
    server,
    entries: new Map(),
    listeningPort: port,
    ready: new Promise<void>((resolve, reject) => {
      const failed = (error: Error): void => {
        if (hosts.get(port) === host) hosts.delete(port);
        reject(error);
      };
      server.once('error', failed);
      server.listen(port, '127.0.0.1', () => {
        server.off('error', failed);
        host.listeningPort = (server.address() as AddressInfo).port;
        console.log(`${bar} 대시보드  http://127.0.0.1:${host.listeningPort}\n`);
        resolve();
      });
    })
  };
  return host;
}

function waitForRequests(entry: DashboardEntry): Promise<void> {
  if (entry.activeRequests === 0) return Promise.resolve();
  entry.drained ??= new Promise<void>((resolve) => {
    entry.resolveDrained = resolve;
  });
  return entry.drained;
}

function unregister(host: DashboardHost, entry: DashboardEntry, port: number): Promise<void> {
  // 이미 같은 대상이 다시 등록되었다면 이전 핸들로 새 연결을 제거하지 않는다.
  if (host.entries.get(entry.id) === entry) host.entries.delete(entry.id);
  entry.handleRequest.close();
  const drained = waitForRequests(entry);
  if (host.entries.size > 0) return drained;
  host.closing ??= new Promise<void>((resolve, reject) => {
    host.server.close((error) => {
      if (hosts.get(port) === host) hosts.delete(port);
      if (error) reject(error);
      else resolve();
    });
  });
  return Promise.all([host.closing, drained]).then(() => undefined);
}

/** 같은 포트를 쓰는 클라이언트를 한 대시보드에 등록한다. */
export async function startDashboard(bridge: DashboardBridge, port: number): Promise<DashboardServer> {
  let host = port === 0 ? undefined : hosts.get(port);
  if (host?.closing) {
    await host.closing;
    return startDashboard(bridge, port);
  }
  if (host === undefined) {
    host = createHost(port);
    if (port !== 0) hosts.set(port, host);
  }
  const id = connectionId(bridge.target);
  if (host.entries.has(id))
    throw new Error(`Arisa target is already registered on dashboard port ${port}: ${bridge.target}`);
  const entry: DashboardEntry = {
    id,
    bridge,
    handleRequest: createDashboardHandler(createClientAdapter(bridge)),
    activeRequests: 0
  };
  host.entries.set(id, entry);
  try {
    await host.ready;
  } catch (error) {
    entry.handleRequest.close();
    if (hosts.get(port) === host) hosts.delete(port);
    throw error;
  }
  const registeredHost = host;
  let closing: Promise<void> | undefined;
  return {
    close() {
      closing ??= unregister(registeredHost, entry, port);
      return closing;
    }
  };
}
