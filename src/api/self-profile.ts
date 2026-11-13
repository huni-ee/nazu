/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import axios from 'axios';
import type {
  Credential,
  KakaoResponse,
  MainProfile,
  ProfileListResponse,
  SelfPostPageResponse,
  SelfPostsResponse,
  SelfProfileDetail,
  SelfProfileResponse,
  SelfRequestResult
} from './types.js';
import { JsonUtil } from '../utils/json/index.js';

/** 등록된 프로필 목록을 조회한다. */
function requestProfileList(credential: Credential): Promise<SelfRequestResult> {
  return axios.get<string>('https://talk-pilsner.kakao.com/talk/profile/list', {
    headers: getHeaders(credential),
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 선택한 내 프로필의 상세 정보를 조회한다. */
function requestSelfProfile(credential: Credential, profileId: string): Promise<SelfRequestResult> {
  return axios.get<string>('https://talk-pilsner.kakao.com/talk/profile25/me', {
    headers: getHeaders(credential),
    params: { profileId, lastSeenAt: '0' },
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 내 게시물 상세를 조회한다. 큰 게시물 ID는 문자열로 전달한다. */
function requestSelfPosts(credential: Credential, postIds: readonly string[]): Promise<SelfRequestResult> {
  return axios.get<string>('https://talk-pilsner.kakao.com/talk/profile25/post/view/me', {
    headers: getHeaders(credential),
    params: { postIds: postIds.join(',') },
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 선택한 내 프로필의 게시물 목록 다음 페이지를 조회한다. */
function requestSelfPostPage(credential: Credential, profileId: string, cursor: string): Promise<SelfRequestResult> {
  return axios.get<string>('https://talk-pilsner.kakao.com/talk/profile25/post/list/me', {
    headers: getHeaders(credential),
    params: { profileId, cursor },
    responseType: 'text',
    maxRedirects: 0
  });
}

/** 메인 프로필을 찾아 표시 정보와 상세 프로필을 함께 가져온다. */
export async function initSelfProfile(credential: Credential): Promise<SelfProfileDetail> {
  const { revision, main } = await getMainProfile(credential);
  const profile = getJson<SelfProfileResponse>(await requestSelfProfile(credential, main.profileId));

  return {
    revision,
    main: {
      nickname: main.nickname,
      statusMessage: main.statusMessage,
      originalProfileImageUrl: main.originalProfileImageUrl
    },
    profile: { ...profile, userId: String(profile.userId) }
  };
}

/** 내 게시물 상세를 조회하고 응답 JSON을 읽는다. 큰 게시물 ID는 문자열로 전달한다. */
export async function initSelfPosts(credential: Credential, postIds: readonly string[]): Promise<SelfPostsResponse> {
  const posts = getJson<SelfPostsResponse>(await requestSelfPosts(credential, postIds));
  return { ...posts, profileId: String(posts.profileId) };
}

/** 최신 프로필 목록에서 메인 프로필을 찾아 게시물 다음 페이지를 가져온다. */
export async function initSelfPostPage(credential: Credential, cursor: string): Promise<SelfPostPageResponse> {
  const { main } = await getMainProfile(credential);
  return getJson<SelfPostPageResponse>(await requestSelfPostPage(credential, main.profileId, cursor));
}

function getHeaders(credential: Credential): Record<string, string> {
  return {
    A: 'android/26.8.2/ko',
    Authorization: `${credential.accessToken}-${credential.deviceUuid}`,
    'User-Agent': 'KT/26.8.2 An/14 ko'
  };
}

function getJson<T extends KakaoResponse>(response: SelfRequestResult): T {
  const data = JsonUtil.parseLossless<T>(response.data);
  if (data.status !== 0) {
    throw new Error(`Kakao API error: ${data.status} body=${response.data}`);
  }
  return data;
}

async function getMainProfile(
  credential: Credential
): Promise<{ readonly revision: number; readonly main: MainProfile }> {
  const list = getJson<ProfileListResponse>(await requestProfileList(credential));
  const main = list.profiles.find((profile) => profile.main === true)!;
  return {
    revision: list.revision,
    main: { ...main, profileId: String(main.profileId) }
  };
}
