/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { Attachment, MapAttachment } from '../types/chat.js';
import { JsonUtil } from '../utils/json/index.js';

/** 첨부 데이터의 ID를 문자열로 바꾼다. */
function normalizeAttachmentIds(value: unknown): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return;

  const attachment = value as Record<string, unknown>;
  for (const key of ['userId', 'lastFeedId', 'src_linkId', 'src_logId', 'src_userId']) {
    if (typeof attachment[key] === 'number') attachment[key] = String(attachment[key]);
  }

  if (Array.isArray(attachment.mentions)) {
    for (const mention of attachment.mentions as unknown[]) {
      if (mention === null || typeof mention !== 'object') continue;
      const entry = mention as Record<string, unknown>;
      if (typeof entry.user_id === 'number') entry.user_id = String(entry.user_id);
    }
  }

  normalizeAttachmentIds(attachment.attach_content);
}

/** 답장의 `src_mentions`를 유저 ID 목록으로 바꾼다. 원본은 `mentions`처럼 `{ user_id, at, len }` 객체 배열이다. */
function collectSourceMentionIds(value: unknown): void {
  if (!isRecord(value) || !Array.isArray(value.src_mentions)) return;

  const ids = new Set<string>();
  for (const mention of value.src_mentions as unknown[]) {
    const id = isRecord(mention) ? mention.user_id : mention;
    if (typeof id === 'string' || typeof id === 'number') ids.add(String(id));
  }
  value.src_mentions = [...ids];
}

export function parseAttachment(value: string): Attachment | null {
  const attachment = JsonUtil.parseLossless<Attachment | null>(value);
  normalizeAttachmentIds(attachment);
  collectSourceMentionIds(attachment);
  return attachment;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 템플릿 항목의 `WEBPC` 링크를 꺼낸다. `kakaomap://` 링크는 `URL`이 경로를 `host`로 읽어서 쓰지 않는다. */
function webLink(item: unknown): string | null {
  if (!isRecord(item) || !isRecord(item.link)) return null;
  return typeof item.link.WEBPC === 'string' ? item.link.WEBPC : null;
}

/** 링크의 `key` 값에서 `위도,경도`를 꺼낸다. */
function findPoint(links: readonly URL[], key: string): Pick<MapAttachment, 'lat' | 'lng'> | null {
  for (const link of links) {
    const match = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(link.searchParams.get(key) ?? '');
    if (match !== null) return { lat: Number(match[1]), lng: Number(match[2]) };
  }
  return null;
}

function mapText(item: unknown): string | null {
  return isRecord(item) && typeof item.txt === 'string' ? item.txt : null;
}

/** 첨부 데이터에서 지도 필드를 꺼낸다. 카카오맵이 아니거나 좌표나 링크가 없으면 `null`이다. */
export function parseMapFields(attachment: Attachment): MapAttachment | null {
  const content = attachment.C;
  const properties = attachment.P;
  if (!isRecord(content) || !isRecord(properties) || properties.SID !== 'kakaomap') return null;

  const buttons =
    isRecord(content.Button) && Array.isArray(content.Button.buttons) ? (content.Button.buttons as unknown[]) : [];
  const links: URL[] = [];
  for (const item of [content.root, ...buttons]) {
    const link = URL.parse(webLink(item) ?? '');
    if (link !== null) links.push(link);
  }

  const point = findPoint(links, 'p') ?? findPoint(links, 'ep');
  const url = typeof properties.DID === 'string' ? properties.DID : webLink(content.root);
  if (point === null || url === null) return null;

  const title = mapText(content['TXT-t1']);
  // 장소 공유는 `/place` 링크가 있고, `TXT-t1`이 이름, `TXT-t1_1`이 주소다.
  if (links.some((link) => link.pathname === '/place')) {
    return { ...point, name: title, address: mapText(content['TXT-t1_1']), url };
  }
  return { ...point, name: null, address: title, url };
}
