/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { initSelfPostPage, initSelfPosts, initSelfProfile, saveAuthProfile } from '../../../api/index.js';
import { isLongId } from '../../../utils/id/index.js';
import { readCredential } from '../credential.js';
import { HttpError, sendJson } from '../http.js';
import { findPost, readPostCursor } from '../posts.js';
import type { RouteContext } from '../types.js';

/** 카카오에서 내 프로필과 내 게시물을 조회한다. */
export async function handleMeRoute({ request, response, url, client }: RouteContext): Promise<boolean> {
  const pathname = url.pathname;
  if (request.method === 'GET' && pathname === '/api/me/profile') {
    const auth = await readCredential(client);
    let selfProfile;
    try {
      selfProfile = await initSelfProfile(auth);
      const savedAuth = saveAuthProfile(auth, selfProfile, client.getDatabase());
      client.setAccountId(savedAuth.raw.user.userId);
    } catch {
      throw new HttpError(503, '내 프로필을 불러올 수 없습니다. 다시 시도해 주세요.');
    }
    let openProfiles = null;
    let directOpenChats = null;
    let groupOpenChats = null;
    let communityOpenChats = null;
    const userId = String(selfProfile.profile.userId);
    const [profilesResult, chatsResult, roomsResult] = await Promise.allSettled([
      client.getOwnOpenProfiles(userId),
      client.getOwnDirectOpenChats(userId),
      client.getOwnOpenChatRooms(userId)
    ]);
    if (profilesResult.status === 'fulfilled') openProfiles = profilesResult.value;
    if (chatsResult.status === 'fulfilled') directOpenChats = chatsResult.value;
    if (roomsResult.status === 'fulfilled') {
      groupOpenChats = roomsResult.value.filter((room) => room.kind === 'group');
      communityOpenChats = roomsResult.value.filter((room) => room.kind === 'community');
    }
    // 오픈프로필·오픈채팅 DB 조회가 실패해도 저장한 내 프로필은 표시한다.
    sendJson(response, 200, { ...selfProfile, openProfiles, directOpenChats, groupOpenChats, communityOpenChats });
    return true;
  }
  const selfPostMatch = /^\/api\/me\/posts\/([^/]+)$/.exec(pathname);
  if (request.method === 'GET' && selfPostMatch !== null) {
    const postId = selfPostMatch[1] ?? '';
    if (!isLongId(postId)) throw new HttpError(400, '게시물 ID가 올바르지 않습니다.');
    const auth = await readCredential(client);
    let data;
    try {
      data = await initSelfPosts(auth, [postId]);
    } catch {
      throw new HttpError(503, '내 게시물을 불러올 수 없습니다. 다시 시도해 주세요.');
    }
    sendJson(response, 200, { post: findPost(data.posts, postId) });
    return true;
  }
  if (request.method === 'GET' && pathname === '/api/me/posts') {
    const cursor = readPostCursor(url);
    const auth = await readCredential(client);
    try {
      const posts = await initSelfPostPage(auth, cursor);
      sendJson(response, 200, { posts });
    } catch {
      throw new HttpError(503, '내 게시물 목록을 불러올 수 없습니다. 다시 시도해 주세요.');
    }
    return true;
  }
  return false;
}
