/*
 * Created on Sun Nov 22 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { readFileSync } from 'node:fs';
import { styleText } from 'node:util';

const packageName = '@huni_ee/nazu';
const timeoutMs = 3000;

let checked = false;

/**
 * src와 dist 모두 `client/` 아래에 있어서 두 단계 위가 패키지 루트다.
 */
function readCurrentVersion(): string | null {
  const url = new URL('../../package.json', import.meta.url);
  const { version } = JSON.parse(readFileSync(url, 'utf8')) as { version?: unknown };
  return typeof version === 'string' ? version : null;
}

/**
 * 프리릴리스(`0.0.0-stage` 등)는 `null`을 돌려줘 비교 대상에서 뺀다.
 */
function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (a === null || b === null) return false;
  return (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) > 0;
}

/**
 * npm 스크립트로 실행하면 설정된 레지스트리를 쓰고, 아니면 npm 공식 레지스트리를 쓴다.
 */
async function fetchLatestVersion(): Promise<string | null> {
  const registry = process.env.npm_config_registry || 'https://registry.npmjs.org/';
  const url = new URL(`${packageName}/latest`, registry.endsWith('/') ? registry : `${registry}/`);
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) return null;
  const { version } = (await response.json()) as { version?: unknown };
  return typeof version === 'string' ? version : null;
}

function installCommand(): string {
  const agent = process.env.npm_config_user_agent ?? '';
  if (agent.startsWith('pnpm/')) return `pnpm add ${packageName}@latest`;
  if (agent.startsWith('yarn/')) return `yarn add ${packageName}@latest`;
  if (agent.startsWith('bun/')) return `bun add ${packageName}@latest`;
  return `npm install ${packageName}@latest`;
}

/**
 * 색은 `styleText`가 터미널 여부와 `NO_COLOR`를 보고 알아서 뺀다.
 */
function formatNotice(current: string, latest: string): string {
  const badge = styleText(['bgYellow', 'black'], ' 업데이트 ');
  const headline = styleText('yellow', `▶ nazu 새 버전이 있습니다: ${current} → ${latest}`);
  const command = styleText('cyan', installCommand());
  return ['', `${badge} ${headline}`, `  ${command} 로 업데이트하세요`, ''].join('\n');
}

/**
 * npm에 올라간 최신 버전이 설치된 버전보다 새로우면 터미널에 안내를 띄운다.
 * 프로세스마다 한 번만 확인하고, 기다리지 않으며, 실패하면 조용히 넘어간다.
 */
export function checkForUpdate(): void {
  if (checked) return;
  checked = true;

  void (async () => {
    try {
      const current = readCurrentVersion();
      if (current === null || parseVersion(current) === null) return;
      const latest = await fetchLatestVersion();
      if (latest === null || !isNewer(latest, current)) return;
      console.log(formatNotice(current, latest));
    } catch {
      // 업데이트 확인은 봇 실행에 꼭 필요하지 않으니 네트워크 오류 등은 무시한다.
    }
  })();
}
