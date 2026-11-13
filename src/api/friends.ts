/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import axios from 'axios';
import type {
  BirthdayFriendsResponse,
  Credential,
  FriendMemoResponse,
  FriendPostPageResponse,
  FriendPostsResponse,
  FriendProfileResponse,
  FriendRequestResult,
  FriendsCreatedAtResponse,
  FriendsListData,
  FriendsSyncResponse,
  KakaoResponse,
  UpdatedProfileFriendsResponse
} from './types.js';
import { JsonUtil } from '../utils/json/index.js';

/** 친구 목록을 동기화한다. */
function requestFriendsSync(credential: Credential, since: string | number = 0): Promise<FriendRequestResult> {
  const headers = getHeaders(credential);
  if (String(since) === '0') headers['talk-priority-level'] = 'critical';

  return axios.get<string>('https://talk-pilsner.kakao.com/talk/friends/sync', {
    headers,
    params: { since: String(since) },
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 친구 추가 시각을 조회한다. */
function requestFriendsCreatedAt(credential: Credential): Promise<FriendRequestResult> {
  return axios.get<string>('https://katalk.kakao.com/android/friends/created-at', {
    headers: getHeaders(credential),
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 생일 친구 목록을 조회한다. */
function requestBirthdayFriends(credential: Credential): Promise<FriendRequestResult> {
  return axios.get<string>('https://katalk.kakao.com/android/account/settings/birthday_friends', {
    headers: getHeaders(credential),
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 프로필을 업데이트한 친구 목록을 조회한다. */
function requestUpdatedProfileFriends(credential: Credential): Promise<FriendRequestResult> {
  return axios.get<string>('https://talk-pilsner.kakao.com/talk/profile25/activity/list', {
    headers: getHeaders(credential),
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 접근 허가 정보로 친구 상세 프로필을 조회한다. */
function requestFriendProfile(
  credential: Credential,
  userId: string,
  accessPermit: string
): Promise<FriendRequestResult> {
  return axios.get<string>('https://talk-pilsner.kakao.com/talk/profile25/other', {
    headers: getHeaders(credential),
    params: { userId, accessPermit },
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 해당 친구에 대해 내가 저장한 메모를 조회한다. */
function requestFriendMemo(credential: Credential, userId: string): Promise<FriendRequestResult> {
  return axios.get<string>(`https://talk-pilsner.kakao.com/talk/friends/memo/${encodeURIComponent(userId)}`, {
    headers: getHeaders(credential),
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 친구 게시물 상세를 조회한다. 큰 게시물 ID는 문자열로 전달한다. */
function requestFriendPosts(
  credential: Credential,
  userId: string,
  postIds: readonly string[]
): Promise<FriendRequestResult> {
  return axios.get<string>('https://talk-pilsner.kakao.com/talk/profile25/post/view/other', {
    headers: getHeaders(credential),
    params: { userId, postIds: postIds.join(',') },
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 친구 게시물 목록의 다음 페이지를 조회한다. */
function requestFriendPostPage(credential: Credential, userId: string, cursor: string): Promise<FriendRequestResult> {
  return axios.get<string>('https://talk-pilsner.kakao.com/talk/profile25/post/list/other', {
    headers: getHeaders(credential),
    params: { userId, cursor },
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 친구 동기화·추가 시각·생일·프로필 업데이트 목록을 함께 가져온다. */
export async function initFriendsList(credential: Credential): Promise<FriendsListData> {
  const [sync, createdAt, birthday, updated] = await Promise.all([
    requestFriendsSync(credential),
    requestFriendsCreatedAt(credential),
    requestBirthdayFriends(credential),
    requestUpdatedProfileFriends(credential)
  ]);

  return {
    sync: getJson<FriendsSyncResponse>(sync),
    createdAt: getJson<FriendsCreatedAtResponse>(createdAt),
    birthday: getJson<BirthdayFriendsResponse>(birthday),
    updated: getJson<UpdatedProfileFriendsResponse>(updated)
  };
}

/** 접근 허가 정보로 친구 상세 프로필을 조회하고 응답 JSON을 읽는다. */
export async function initFriendProfile(
  credential: Credential,
  userId: string,
  accessPermit: string
): Promise<FriendProfileResponse> {
  const profile = getJson<FriendProfileResponse>(await requestFriendProfile(credential, userId, accessPermit));
  return { ...profile, userId: String(profile.userId) };
}

/** 해당 친구에 대해 내가 저장한 메모를 조회하고 응답 JSON을 읽는다. */
export async function initFriendMemo(credential: Credential, userId: string): Promise<FriendMemoResponse> {
  return getJson<FriendMemoResponse>(await requestFriendMemo(credential, userId));
}

/** 친구 게시물 상세를 조회하고 응답 JSON을 읽는다. 큰 게시물 ID는 문자열로 전달한다. */
export async function initFriendPosts(
  credential: Credential,
  userId: string,
  postIds: readonly string[]
): Promise<FriendPostsResponse> {
  const posts = getJson<FriendPostsResponse>(await requestFriendPosts(credential, userId, postIds));
  return { ...posts, userId: String(posts.userId) };
}

/** 친구 게시물 목록의 다음 페이지를 조회하고 응답 JSON을 읽는다. */
export async function initFriendPostPage(
  credential: Credential,
  userId: string,
  cursor: string
): Promise<FriendPostPageResponse> {
  return getJson<FriendPostPageResponse>(await requestFriendPostPage(credential, userId, cursor));
}

function getHeaders(credential: Credential): Record<string, string> {
  return {
    A: 'android/26.8.2/ko',
    Authorization: `${credential.accessToken}-${credential.deviceUuid}`,
    'User-Agent': 'KT/26.8.2 An/14 ko'
  };
}

function getJson<T extends KakaoResponse>(response: FriendRequestResult): T {
  const data = JsonUtil.parseLossless<T>(response.data);
  if (data.status !== 0) {
    throw new Error(`Kakao API error: ${data.status} body=${response.data}`);
  }
  return data;
}
