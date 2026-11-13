/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { Attachment } from '../types/chat.js';
import { JsonUtil } from '../utils/json/index.js';

/** 첨부 데이터의 ID를 문자열로 바꾼다. */
function normalizeAttachmentIds(value: unknown): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return;

  const attachment = value as Record<string, unknown>;
  for (const key of ['accountId', 'userId', 'src_linkId', 'src_logId', 'src_userId']) {
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

export function parseAttachment(value: string): Attachment | null {
  const attachment = JsonUtil.parseLossless<Attachment | null>(value);
  normalizeAttachmentIds(attachment);
  return attachment;
}
