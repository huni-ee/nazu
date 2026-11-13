/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { lookup } from 'mime-types';

import type { MediaFile, MediaInput } from '../types/channel.js';

/** 미디어 파일을 준비한다. */
export async function prepareMedia(value: MediaInput): Promise<MediaFile> {
  let data: Uint8Array;
  let name: string | undefined;
  let mime: string | undefined;

  if (typeof value === 'string') {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const response = await fetch(value);
      if (!response.ok) {
        throw new Error(`파일 다운로드에 실패했습니다: ${response.status} ${response.statusText}`);
      }

      data = new Uint8Array(await response.arrayBuffer());
      name = basename(new URL(value).pathname) || undefined;
      mime = response.headers.get('content-type')?.split(';')[0];
    } else {
      data = await readFile(value);
      name = basename(value);
    }
  } else if (value instanceof Uint8Array) {
    data = value;
  } else {
    data = value.data;
    name = value.name;
    mime = value.mime;
  }

  const mediaType = mime ?? (lookup(name ?? '') || 'application/octet-stream');
  if (name === undefined) return { data, mime: mediaType };
  return { data, name, mime: mediaType };
}
