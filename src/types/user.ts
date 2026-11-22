/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

/**
 * 일반 채팅방 멤버 종류. `member` 일반 멤버, `host` 방장, `moderator` 부방장
 */
export type NormalMemberType = 'member' | 'host' | 'moderator';

/**
 * 오픈채팅 프로필 종류
 */
export type OpenProfileType = 'unknown' | 'default' | 'kakao' | 'open';

/**
 * 오픈채팅방 멤버 종류
 */
export type OpenMemberType = 'unknown' | 'host' | 'member' | 'moderator' | 'bot';

/**
 * 유저 원본 데이터
 */
export type UserRaw = {
  /**
   * 유저 ID
   */
  readonly id: string;
  /**
   * 내 계정 여부
   */
  readonly isMine: boolean;
  /**
   * 유저 이름
   */
  readonly name: string;
  /**
   * 친구 정보에서 내가 지정한 이름. 없으면 `null`
   */
  readonly customName: string | null;
  /**
   * 프로필 이미지 주소. 없으면 `null`
   */
  readonly profileImageUrl: string | null;
};

/**
 * 일반 채팅방 유저의 원본 데이터
 */
export type NormalUserRaw = UserRaw & {
  /**
   * 채팅방 멤버 종류
   */
  readonly memberType: NormalMemberType;
  /**
   * 프로필 종류. 일반 채팅방은 항상 `default`
   */
  readonly profileType: 'default';
};

/**
 * 오픈채팅방 유저의 원본 데이터
 */
export type OpenUserRaw = UserRaw & {
  /**
   * 오픈채팅방 안의 멤버 정보
   */
  readonly openChannel: {
    /**
     * 오픈채팅방 멤버 종류
     */
    readonly memberType: OpenMemberType;
    /**
     * 오픈채팅 프로필 종류
     */
    readonly profileType: OpenProfileType;
    /**
     * 오픈프로필 링크 ID
     */
    readonly profileLinkId: string;
  };
};

/**
 * 채팅방에 추가된 챗봇의 원본 데이터
 */
export type BotUserRaw = UserRaw & {
  /**
   * 멤버 종류. 항상 `bot`
   */
  readonly memberType: 'bot';
  /**
   * 프로필 종류. 항상 `default`
   */
  readonly profileType: 'default';
};

/**
 * 내 계정의 원본 데이터. 일반 채팅방이면 `memberType`과 `profileType`을, 오픈채팅방이면 `openChannel`을 가집니다.
 */
export type UserSelfRaw = UserRaw &
  (
    | {
        /**
         * 채팅방 멤버 종류
         */
        readonly memberType: OpenMemberType;
        /**
         * 프로필 종류
         */
        readonly profileType: 'default';
      }
    | {
        /**
         * 오픈채팅방 안의 멤버 정보
         */
        readonly openChannel: {
          /**
           * 오픈채팅방 멤버 종류
           */
          readonly memberType: OpenMemberType;
          /**
           * 오픈채팅 프로필 종류
           */
          readonly profileType: OpenProfileType;
          /**
           * 오픈프로필 링크 ID
           */
          readonly profileLinkId: string;
        };
      }
  );

/**
 * 내 카카오톡 프로필
 */
export type SelfProfile = {
  /**
   * 내 유저 ID
   */
  readonly userId: string;
  /**
   * 닉네임
   */
  readonly nickname: string;
  /**
   * 상태 메세지
   */
  readonly statusMessage: string;
  /**
   * 원본 크기 프로필 이미지 주소
   */
  readonly originalProfileImageUrl: string;
  /**
   * 기본 프로필 여부
   */
  readonly main: true;
};
