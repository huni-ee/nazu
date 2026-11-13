/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import {
  initFriendMemo,
  initFriendPostPage,
  initFriendPosts,
  initFriendProfile,
  initFriendsList,
  type Credential,
  type FriendsListData
} from '../../../api/index.js';
import { isLongId } from '../../../utils/id/index.js';
import { readCredential } from '../credential.js';
import { HttpError, sendJson } from '../http.js';
import { findPost, readPostCursor } from '../posts.js';
import type { DashboardClient, Route } from '../types.js';
import { isRecord } from '../validation.js';

interface FriendsState {
  pending: Promise<FriendsListData> | undefined;
  deviceUuid: string | undefined;
  list: unknown[] | undefined;
}

function isCurrentFriend(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.userType !== 1 &&
    value.purged !== true &&
    value.isPurged !== true &&
    (value.type === 1 || value.type === 2 || value.type === 3)
  );
}

async function readFriends(
  client: DashboardClient,
  friends: FriendsState,
  credential?: Credential
): Promise<FriendsListData> {
  const auth = credential ?? (await readCredential(client));
  try {
    const data = await initFriendsList(auth);
    friends.deviceUuid = auth.deviceUuid;
    friends.list = data.sync.friends;
    return data;
  } catch {
    throw new HttpError(503, '친구 목록을 불러올 수 없습니다.');
  }
}

async function readFriend(
  client: DashboardClient,
  friends: FriendsState,
  userId: string
): Promise<{ readonly auth: Credential; readonly friend: Record<string, unknown> }> {
  const auth = await readCredential(client);
  if (friends.deviceUuid !== auth.deviceUuid) {
    friends.deviceUuid = undefined;
    friends.list = undefined;
  }
  const entries = friends.list ?? (await readFriends(client, friends, auth)).sync.friends;
  const friend = entries.find(
    (entry): entry is Record<string, unknown> => isCurrentFriend(entry) && String(entry.userId) === userId
  );
  if (!friend) throw new HttpError(404, '현재 친구 목록에 없는 유저입니다. 친구 목록을 새로고침해 주세요.');
  return { auth, friend };
}

async function readFriendAccess(
  client: DashboardClient,
  friends: FriendsState,
  userId: string
): Promise<{ readonly auth: Credential; readonly accessPermit: string }> {
  const { auth, friend } = await readFriend(client, friends, userId);
  if (typeof friend.accessPermit !== 'string' || !friend.accessPermit.trim()) {
    throw new HttpError(403, '친구 프로필에 접근할 수 없습니다. 친구 목록을 새로고침해 주세요.');
  }
  return { auth, accessPermit: friend.accessPermit };
}

/**
 * 친구 목록·프로필·메모·게시물을 카카오에서 조회한다.
 * 친구 목록은 연결마다 캐시하고, 동시에 들어온 목록 요청은 하나로 합친다.
 */
export function createFriendRoute(): Route {
  const friends: FriendsState = {
    pending: undefined,
    deviceUuid: undefined,
    list: undefined
  };
  return async ({ request, response, url, client }) => {
    const pathname = url.pathname;
    if (request.method === 'GET' && pathname === '/api/friends') {
      friends.pending ??= readFriends(client, friends).finally(() => {
        friends.pending = undefined;
      });
      const data = await friends.pending;
      sendJson(response, 200, data);
      return true;
    }
    const friendProfileMatch = /^\/api\/friends\/([1-9]\d*)\/profile$/.exec(pathname);
    if (request.method === 'GET' && friendProfileMatch !== null) {
      const userId = friendProfileMatch[1] ?? '';
      const { auth, accessPermit } = await readFriendAccess(client, friends, userId);
      try {
        const profile = await initFriendProfile(auth, userId, accessPermit);
        sendJson(response, 200, { profile });
      } catch {
        throw new HttpError(503, '친구 프로필을 불러올 수 없습니다. 친구 목록을 새로고침한 뒤 다시 시도해 주세요.');
      }
      return true;
    }
    const friendMemoMatch = /^\/api\/friends\/([1-9]\d*)\/memo$/.exec(pathname);
    if (request.method === 'GET' && friendMemoMatch !== null) {
      const userId = friendMemoMatch[1] ?? '';
      const { auth } = await readFriend(client, friends, userId);
      try {
        const { memo } = await initFriendMemo(auth, userId);
        sendJson(response, 200, { memo });
      } catch {
        throw new HttpError(503, '친구 메모를 불러올 수 없습니다. 다시 시도해 주세요.');
      }
      return true;
    }
    const friendPostMatch = /^\/api\/friends\/([1-9]\d*)\/posts\/([1-9]\d*)$/.exec(pathname);
    if (request.method === 'GET' && friendPostMatch !== null) {
      const userId = friendPostMatch[1] ?? '';
      const postId = friendPostMatch[2] ?? '';
      if (!isLongId(postId)) throw new HttpError(400, '게시물 ID가 올바르지 않습니다.');
      const { auth } = await readFriendAccess(client, friends, userId);
      let data;
      try {
        data = await initFriendPosts(auth, userId, [postId]);
      } catch {
        throw new HttpError(503, '친구 게시물을 불러올 수 없습니다. 친구 목록을 새로고침한 뒤 다시 시도해 주세요.');
      }
      sendJson(response, 200, { post: findPost(data.posts, postId) });
      return true;
    }
    const friendPostPageMatch = /^\/api\/friends\/([1-9]\d*)\/posts$/.exec(pathname);
    if (request.method === 'GET' && friendPostPageMatch !== null) {
      const userId = friendPostPageMatch[1] ?? '';
      const cursor = readPostCursor(url);
      const { auth } = await readFriendAccess(client, friends, userId);
      try {
        const posts = await initFriendPostPage(auth, userId, cursor);
        sendJson(response, 200, { posts });
      } catch {
        throw new HttpError(503, '친구 게시물 목록을 불러올 수 없습니다. 다시 시도해 주세요.');
      }
      return true;
    }
    return false;
  };
}
