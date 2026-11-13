/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

/**
 * 일반 채팅방 종류입니다.
 *
 * - `MemoChat`: 나와의 채팅
 * - `DirectChat`: 1:1 채팅
 * - `MultiChat`: 그룹 채팅
 * - `TeamMultiChat`: 팀채팅
 * - `PlusChat`: 카카오톡 채널
 */
export type NormalChannelType = 'MemoChat' | 'DirectChat' | 'MultiChat' | 'TeamMultiChat' | 'PlusChat';

/**
 * 오픈채팅방 종류입니다.
 *
 * - `OD`: 1:1 오픈채팅
 * - `OM`: 그룹 오픈채팅
 * - `COM`: 커뮤니티 오픈 그룹 채팅
 */
export type OpenChannelType = 'OD' | 'OM' | 'COM';

/** 바이트로 보낼 파일입니다. */
export interface MediaFile {
  /** 파일 바이트입니다. */
  readonly data: Uint8Array;
  /** 파일 이름입니다. */
  readonly name?: string;
  /** MIME 타입입니다. */
  readonly mime?: string;
}

/** 보낼 파일입니다. 파일 경로나 URL 문자열, 파일 바이트, {@link MediaFile} 중 하나입니다. */
export type MediaInput = string | Uint8Array | MediaFile;

/** 미디어 전송 방식입니다. `single`은 파일을 한 개씩, `multiple`은 여러 장을 한 메세지로 보냅니다. */
export type MediaMode = 'single' | 'multiple';

/** 미디어 전송 옵션입니다. */
export interface SendMediaOptions {
  /** 전송 방식입니다. 생략하면 입력이 하나일 때 `single`, 배열일 때 `multiple`입니다. */
  readonly mode?: MediaMode;
}

/** 유저별 채팅 수를 셀 때의 조건입니다. */
export interface ChatCountOptions {
  /** 피드도 채팅 수에 넣을지 정합니다. 기본값은 `false`입니다. */
  readonly includeFeed?: boolean;
  /** 집계 시작 시각입니다. 생략하면 Unix 시간 0부터 셉니다. */
  readonly startDate?: Date;
  /** 집계 종료 시각입니다. 생략하면 현재 시각까지 셉니다. */
  readonly endDate?: Date;
}

/** 유저 한 명의 채팅 수입니다. */
export interface ChatCount<TUser = unknown> {
  /** 대상 유저입니다. */
  readonly user: TUser;
  /** 채팅 수입니다. */
  readonly count: number;
}

/** 오픈채팅방 정보입니다. */
export interface OpenChannelInfo {
  /** 오픈채팅방 이름입니다. */
  readonly name: string;
  /** 오픈채팅방 링크입니다. */
  readonly url: string;
  /** 대표 이미지 주소입니다. */
  readonly imageUrl: string;
  /** 활성 상태입니다. */
  readonly active: boolean;
  /** 만료 상태입니다. */
  readonly expired: boolean;
  /** 만든 시각입니다. 서버가 준 숫자 값 그대로입니다. */
  readonly createdAt: number;
  /** 오픈채팅방 설명입니다. */
  readonly description: string;
}

/** 채팅방 원본 데이터입니다. */
export interface ChannelRaw {
  /** 채팅방 ID입니다. */
  readonly id: string;
  /** 채팅방 종류입니다. 값은 {@link NormalChannelType}과 {@link OpenChannelType}을 참고하세요. */
  readonly type: string;
  /** 채팅방 이름입니다. */
  readonly name: string | null;
  /** 채팅방 이름 설정에서 내가 지정한 이름입니다. */
  readonly privateName: string | null;
  /** 오픈채팅방 정보입니다. 일반 채팅방에서는 `null`입니다. */
  readonly openChannel: OpenChannelInfo | null;
}
