/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { HttpError } from './http.js';
import { hasControlCharacter, isRecord } from './validation.js';

/** 게시물 목록 다음 페이지를 가리키는 cursor 값을 하나만 받는다. */
export function readPostCursor(url: URL): string {
  const cursors = url.searchParams.getAll('cursor');
  const cursor = cursors[0];
  if (
    cursors.length !== 1 ||
    cursor === undefined ||
    !cursor.trim() ||
    cursor.length > 4096 ||
    hasControlCharacter(cursor)
  ) {
    throw new HttpError(400, '게시물 페이지 커서가 올바르지 않습니다.');
  }
  return cursor;
}

/** 카카오 응답에서 요청한 게시물을 찾는다. 게시물 ID는 숫자로 올 수도 있다. */
export function findPost(posts: readonly unknown[], postId: string): unknown {
  const post = posts.find(
    (entry) =>
      isRecord(entry) &&
      (typeof entry.postId === 'string' || typeof entry.postId === 'number') &&
      String(entry.postId) === postId
  );
  if (!post) throw new HttpError(404, '게시물을 찾을 수 없습니다.');
  return post;
}
