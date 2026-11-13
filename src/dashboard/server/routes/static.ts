/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { readFile, realpath } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from '../http.js';
import type { RouteContext } from '../types.js';
import { isRecord } from '../validation.js';

const webRoot = fileURLToPath(new URL('../../web/', import.meta.url));
const staticDirectories = ['/assets/', '/images/', '/icons/', '/fonts/'];

function mimeType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

async function sendStatic(response: ServerResponse, pathname: string): Promise<void> {
  const encodedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    throw new HttpError(400, '잘못된 경로입니다.');
  }
  if (
    decodedPath.includes('\\') ||
    decodedPath.includes(':') ||
    decodedPath.includes('\0') ||
    decodedPath.split('/').some((part) => part === '' || part.startsWith('.'))
  ) {
    throw new HttpError(404, '파일을 찾을 수 없습니다.');
  }
  const filePath = resolve(webRoot, decodedPath);
  const relativePath = relative(webRoot, filePath);
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new HttpError(404, '파일을 찾을 수 없습니다.');
  }
  let file: Buffer;
  try {
    const [realRoot, realFile] = await Promise.all([realpath(webRoot), realpath(filePath)]);
    const realRelativePath = relative(realRoot, realFile);
    if (
      realRelativePath === '' ||
      realRelativePath === '..' ||
      realRelativePath.startsWith(`..${sep}`) ||
      isAbsolute(realRelativePath)
    ) {
      throw new HttpError(404, '파일을 찾을 수 없습니다.');
    }
    file = await readFile(realFile);
  } catch (error) {
    if (isRecord(error) && (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EISDIR')) {
      throw new HttpError(404, '파일을 찾을 수 없습니다.');
    }
    throw error;
  }
  response.writeHead(200, { 'Content-Type': mimeType(filePath) });
  response.end(file);
}

/** 화면 파일(index.html, 빌드한 CSS·JS, 이미지, 폰트)을 보낸다. 심볼릭 링크로 web 폴더 밖을 읽지 않는다. */
export async function handleStaticRoute({ request, response, url }: RouteContext): Promise<boolean> {
  const pathname = url.pathname;
  if (request.method !== 'GET') return false;
  if (pathname !== '/' && !staticDirectories.some((directory) => pathname.startsWith(directory))) return false;
  await sendStatic(response, pathname);
  return true;
}
