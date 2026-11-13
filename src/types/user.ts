/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

/** 일반 채팅방에서의 멤버 종류입니다. 일반 멤버, 방장, 부방장 중 하나입니다. */
export type NormalMemberType = 'member' | 'host' | 'moderator';

/** 오픈채팅 프로필 종류입니다. */
export type OpenProfileType = 'unknown' | 'default' | 'kakao' | 'open';

/** 오픈채팅방에서의 멤버 종류입니다. */
export type OpenMemberType = 'unknown' | 'host' | 'member' | 'moderator' | 'bot';

/** 유저 원본 데이터입니다. */
export type UserRaw = {
  /** 유저 ID입니다. */
  readonly id: string;
  /** 내 계정이면 `true`입니다. */
  readonly isMine: boolean;
  /** 유저 이름입니다. */
  readonly name: string;
  /** 친구 정보에서 내가 지정한 이름입니다. 없으면 `null`입니다. */
  readonly customName: string | null;
  /** 프로필 이미지 주소입니다. 없으면 `null`입니다. */
  readonly profileImageUrl: string | null;
};

/** 일반 채팅방 유저의 원본 데이터입니다. */
export type NormalUserRaw = UserRaw & {
  /** 채팅방에서의 멤버 종류입니다. */
  readonly memberType: NormalMemberType;
  /** 프로필 종류입니다. 일반 채팅방에서는 항상 `default`입니다. */
  readonly profileType: 'default';
};

/** 오픈채팅방 유저의 원본 데이터입니다. */
export type OpenUserRaw = UserRaw & {
  /** 오픈채팅방에서의 정보입니다. */
  readonly openChannel: {
    /** 오픈채팅방에서의 멤버 종류입니다. */
    readonly memberType: OpenMemberType;
    /** 오픈채팅 프로필 종류입니다. */
    readonly profileType: OpenProfileType;
    /** 오픈프로필 링크 ID입니다. */
    readonly profileLinkId: string;
  };
};

/** 채팅방에 추가된 챗봇의 원본 데이터입니다. */
export type BotUserRaw = UserRaw & {
  /** 멤버 종류입니다. 항상 `bot`입니다. */
  readonly memberType: 'bot';
  /** 프로필 종류입니다. 항상 `default`입니다. */
  readonly profileType: 'default';
};

/** 내 계정의 원본 데이터입니다. 일반 채팅방에서는 `memberType`과 `profileType`을, 오픈채팅방에서는 `openChannel`을 가집니다. */
export type UserSelfRaw = UserRaw &
  (
    | {
        /** 채팅방에서의 멤버 종류입니다. */
        readonly memberType: OpenMemberType;
        /** 프로필 종류입니다. */
        readonly profileType: 'default';
      }
    | {
        /** 오픈채팅방에서의 정보입니다. */
        readonly openChannel: {
          /** 오픈채팅방에서의 멤버 종류입니다. */
          readonly memberType: OpenMemberType;
          /** 오픈채팅 프로필 종류입니다. */
          readonly profileType: OpenProfileType;
          /** 오픈프로필 링크 ID입니다. */
          readonly profileLinkId: string;
        };
      }
  );

/** 내 카카오톡 프로필입니다. */
export type SelfProfile = {
  /** 내 유저 ID입니다. */
  readonly userId: string;
  /** 닉네임입니다. */
  readonly nickname: string;
  /** 상태 메세지입니다. */
  readonly statusMessage: string;
  /** 원본 크기 프로필 이미지 주소입니다. */
  readonly originalProfileImageUrl: string;
  /** 기본 프로필이면 `true`입니다. */
  readonly main: true;
};
