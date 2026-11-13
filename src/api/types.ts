/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { AxiosResponse } from 'axios';
import type { SelfProfile } from '../types/user.js';

/** 카카오 API 공통 응답 */
export interface KakaoResponse {
  readonly status: number;
  readonly [key: string]: unknown;
}

// api/auth.ts

/** 인증 정보 */
export interface Credential {
  /** 액세스 토큰 */
  readonly accessToken: string;

  /** 리프레시 토큰 */
  readonly refreshToken: string;

  /** 기기 UUID */
  readonly deviceUuid: string;
}

/** 인증 정보와 메인 프로필 */
export interface KakaoAuthData {
  /**
   * 카카오톡 액세스 토큰
   */
  readonly accessToken: string;

  /**
   * 카카오톡 리프레시 토큰
   */
  readonly refreshToken: string;

  /**
   * 카카오톡 기기 UUID
   */
  readonly deviceUuid: string;

  /**
   * 프로필 목록 리비전
   */
  readonly revision: number;

  /**
   * 메인 프로필 정보
   */
  readonly raw: {
    readonly user: SelfProfile;
  };

  /**
   * 내 프로필 API 응답 상태 코드
   */
  readonly status: number;
}

// api/friends.ts

/** JSON으로 변환하기 전의 Axios 응답 */
export type FriendRequestResult = AxiosResponse<string>;

/** 친구 동기화 목록 */
export interface FriendsSyncResponse extends KakaoResponse {
  readonly friends: unknown[];
}

/** 사용자 ID별 친구 추가 시각 (Unix 초) */
export interface FriendsCreatedAtResponse extends KakaoResponse {
  readonly createdAt: Readonly<Record<string, number>>;
}

/** 날짜별 생일 친구 정보 */
export interface BirthdayFriendsResponse extends KakaoResponse {
  readonly birthday_friends: Record<string, unknown>;
}

/** 프로필을 업데이트한 친구 목록 */
export interface UpdatedProfileFriendsResponse extends KakaoResponse {
  readonly users: unknown[];
}

/** 친구 상세 프로필 */
export interface FriendProfileResponse extends KakaoResponse {
  readonly userId: string;
}

/** 내가 저장한 친구 메모 */
export interface FriendMemoResponse extends KakaoResponse {
  readonly memo: string;
}

/** 친구 게시물 상세 */
export interface FriendPostsResponse extends KakaoResponse {
  readonly userId: string;
  readonly posts: unknown[];
}

/** 친구 게시물 목록과 다음 페이지 커서 */
export interface FriendPostPageResponse extends KakaoResponse {
  readonly contents: unknown[];
  readonly cursor?: string | null;
}

export interface FriendsListData {
  readonly sync: FriendsSyncResponse;
  readonly createdAt: FriendsCreatedAtResponse;
  readonly birthday: BirthdayFriendsResponse;
  readonly updated: UpdatedProfileFriendsResponse;
}

// api/self-profile.ts

/** JSON으로 변환하기 전의 내 프로필 API Axios 응답 */
export type SelfRequestResult = AxiosResponse<string>;

/** 등록된 내 프로필 정보 */
export interface MainProfile {
  /** 프로필 ID */
  readonly profileId: string;

  /** 프로필 닉네임 */
  readonly nickname: string;

  /** 프로필 상태 메세지 */
  readonly statusMessage: string;

  /** 원본 프로필 이미지 URL */
  readonly originalProfileImageUrl: string;

  /** 메인 프로필 여부 */
  readonly main: boolean;
}

/** 내 프로필 목록 응답 */
export interface ProfileListResponse extends KakaoResponse {
  /** 프로필 목록 리비전 */
  readonly revision: number;

  /** 등록된 프로필 목록 */
  readonly profiles: readonly MainProfile[];
}

/** 내 프로필 상세 응답 */
export interface SelfProfileResponse extends KakaoResponse {
  /** 로그인한 카카오톡 사용자 ID */
  readonly userId: string;
}

/** 메인 프로필 정보와 내 프로필 상세 */
export interface SelfProfileDetail {
  /** 프로필 목록 리비전 */
  readonly revision: number;

  /** 메인 프로필의 표시 정보 */
  readonly main: {
    /** 프로필 닉네임 */
    readonly nickname: string;

    /** 프로필 상태 메세지 */
    readonly statusMessage: string;

    /** 원본 프로필 이미지 URL */
    readonly originalProfileImageUrl: string;
  };

  /** 내 프로필 상세 원본 응답 */
  readonly profile: SelfProfileResponse;
}

/** 내 게시물 상세 응답 */
export interface SelfPostsResponse extends KakaoResponse {
  /** 게시물을 작성한 프로필 ID */
  readonly profileId: string;

  /** 게시물 상세 목록 */
  readonly posts: readonly unknown[];
}

/** 내 게시물 페이지 응답 */
export interface SelfPostPageResponse extends KakaoResponse {
  /** 현재 페이지의 게시물 목록 */
  readonly contents: readonly unknown[];

  /** 다음 페이지 조회 커서 */
  readonly cursor?: string | null;
}
