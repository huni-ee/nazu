/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { ChannelRaw } from './channel.js';
import type { UserRaw } from './user.js';

/** 메세지가 속한 범위 */
export type MessageScopeName = 'unknown' | 'channel' | 'thread' | 'all';

/**
 * 메세지 첨부 데이터. 키는 카카오톡이 보낸 원본 그대로이며, 아래에 없는 키가 더 있을 수 있습니다.
 * 메세지 종류별 첨부 데이터는 이 타입을 확장합니다.
 */
export interface Attachment extends Record<string, unknown> {
  /** 외치기 메세지 여부 */
  readonly shout?: boolean;
  /** 멘션 목록 */
  readonly mentions?: {
    /** 멘션된 유저 ID */
    readonly user_id: string;
    /** 이 유저가 메세지의 몇 번째 멘션인지 담은 목록. 1부터 셉니다. */
    readonly at: number[];
    /** `@`를 뺀 멘션 이름 길이 */
    readonly len: number;
  }[];
  /** `@all`로 전체를 멘션했을 때만 있습니다. 한 명씩 한 멘션은 `mentions`에 들어갑니다. */
  readonly all_mention?: {
    /** 멘션 위치. `mentions`의 `at`과 달리 숫자 하나 */
    readonly at: number;
  };
  /** 메세지에 들어 있는 URL 목록 */
  readonly urls?: string[];
}

/** 메세지 수정 기록 한 건 */
export interface MessageRevisionRaw {
  /** 수정 번호 */
  readonly revision: number;
  /** 이 수정의 메세지 내용 */
  readonly message: string;
}

/** 메세지 원본 데이터 */
export interface MessageChatRaw {
  /** 메세지 로그 ID */
  readonly logId: string;
  /** 스레드 ID. 스레드에 속하지 않으면 `null` */
  readonly threadId: string | null;
  /** 원본 메세지 타입 번호 */
  readonly type: number;
  /** 메세지가 속한 범위 */
  readonly scope: MessageScopeName;
  /** 메세지 내용 */
  readonly message: string;
  /** 첨부 데이터 */
  readonly attachment: Attachment;
  /** 수정 기록 */
  readonly modifyLog: MessageRevisionRaw[];
  /** 보낸 유저. 정보가 없으면 `null` */
  readonly user: UserRaw | null;
  /** 메세지가 온 채팅방 */
  readonly channel: ChannelRaw;
}

/** 멘션이 있는 메세지의 첨부 데이터 */
export interface MentionAttachment extends Attachment {
  /** 멘션 목록 */
  readonly mentions?: {
    /** 멘션된 유저 ID */
    readonly user_id: string;
    /** 이 유저가 메세지의 몇 번째 멘션인지 담은 목록. 1부터 셉니다. */
    readonly at: number[];
    /** `@`를 뺀 멘션 이름 길이 */
    readonly len: number;
  }[];
  /** `@all`로 전체를 멘션했을 때만 있습니다. 한 명씩 한 멘션은 `mentions`에 들어갑니다. */
  readonly all_mention?: {
    /** 멘션 위치. `mentions`의 `at`과 달리 숫자 하나 */
    readonly at: number;
  };
}

/** 사진 메세지의 첨부 데이터 */
export interface PhotoAttachment extends Attachment {
  readonly cmt?: string;
  readonly cs: string;
  readonly expire: number;
  /** 원본 사진 높이 */
  readonly h: number;
  readonly k: string;
  readonly mt: string;
  readonly s: number;
  /** 미리보기 높이 */
  readonly thumbnailHeight: number;
  /** 미리보기 이미지 주소 */
  readonly thumbnailUrl: string;
  /** 미리보기 너비 */
  readonly thumbnailWidth: number;
  /** 사진 주소 */
  readonly url: string;
  /** 원본 사진 너비 */
  readonly w: number;
}

/** 동영상 메세지의 첨부 데이터 */
export interface VideoAttachment extends Attachment {
  readonly cmt?: string;
  readonly cs: string;
  readonly csh?: string;
  readonly d: number;
  readonly dh?: number;
  readonly expire: number;
  /** 동영상 높이 */
  readonly h: number;
  readonly hh?: number;
  readonly s: number;
  readonly sh?: number;
  readonly tk: string;
  readonly tkh?: string;
  /** 동영상 주소 */
  readonly url: string;
  readonly urlh?: string;
  /** 동영상 너비 */
  readonly w: number;
  readonly wh?: number;
}

/** 음성 메세지의 첨부 데이터 */
export interface AudioAttachment extends Attachment {
  readonly d: number;
  readonly expire: number;
  readonly k: string;
  readonly s: number;
  /** 음성 파일 주소 */
  readonly url: string;
}

/** 이모티콘 메세지의 첨부 데이터 */
export interface EmoticonAttachment extends Attachment {
  /** 이모티콘 대체 텍스트 */
  readonly alt: string;
  readonly height?: string | number;
  readonly msg?: string;
  /** 이모티콘 이름 */
  readonly name: string;
  /** 이모티콘 경로 */
  readonly path: string;
  readonly sound?: string;
  readonly type?: string;
  readonly welcome?: boolean;
  readonly width?: string | number;
  readonly s?: string | number;
  readonly xconVersion?: string | number;
}

/** 미니 이모티콘이 들어 있는 메세지의 첨부 데이터 */
export interface MiniEmoticonAttachment {
  /** 메세지 안의 미니 이모티콘 목록 */
  readonly items: {
    readonly at: number[];
    readonly id: string;
    readonly len: number;
  }[];
  readonly total_item: number;
  readonly total_len: number;
}

/** 지도 메세지의 첨부 데이터 */
export interface MapAttachment {
  /** 위도 */
  readonly lat: number;
  /** 경도 */
  readonly lng: number;
  /** 장소 이름. 장소를 공유하지 않았으면 `null` */
  readonly name: string | null;
  /** 주소. 없으면 `null` */
  readonly address: string | null;
  /** 카카오맵 링크 */
  readonly url: string;
}

/** 프로필 공유 메세지의 첨부 데이터 */
export interface ProfileAttachment extends Attachment {
  readonly accessPermit: string;
  /** 큰 프로필 이미지 주소 */
  readonly fullProfileImageUrl: string;
  /** 닉네임 */
  readonly nickName: string;
  /** 프로필 이미지 주소 */
  readonly profileImageUrl: string;
  /** 상태 메세지 */
  readonly statusMessage?: string;
  /** 유저 ID */
  readonly userId: string;
}

/** 파일 메세지의 첨부 데이터 */
export interface FileAttachment extends Attachment {
  readonly cs: string;
  readonly expire: number;
  readonly k: string;
  /** 파일 이름 */
  readonly name: string;
  readonly s: number;
  /** 파일 크기 */
  readonly size: number;
  /** 파일 주소 */
  readonly url: string;
}

/** 여러 장의 사진을 묶은 메세지의 첨부 데이터 */
export interface MultiPhotoAttachment extends Attachment {
  readonly cmtl: string[];
  readonly csl: string[];
  readonly ctMeta?: string;
  readonly expire: number;
  readonly hl: number[];
  /** 사진 주소 목록 */
  readonly imageUrls: string[];
  readonly kl: string[];
  readonly lastFeedId?: string;
  readonly mtl: string[];
  readonly sl: number[];
  /** 미리보기 높이 목록 */
  readonly thumbnailHeights: number[];
  /** 미리보기 이미지 주소 목록 */
  readonly thumbnailUrls: string[];
  /** 미리보기 너비 목록 */
  readonly thumbnailWidths: number[];
  readonly wl: number[];
}

/** 답장 메세지의 첨부 데이터. `src_`로 시작하는 키는 답장 대상 메세지의 정보 */
export interface ReplyAttachment extends Attachment {
  readonly attach_only?: boolean;
  /** 답장에 붙은 이모티콘 데이터 */
  readonly attach_content?: EmoticonAttachment;
  readonly attach_type?: number;
  readonly src_linkId: string;
  /** 답장 대상 메세지의 로그 ID. `getSource()`가 이 값으로 메세지를 찾습니다. */
  readonly src_logId: string;
  /** 답장 대상 메세지 내용 */
  readonly src_message: string;
  /** 답장 대상 메세지 타입 번호 */
  readonly src_type: number;
  /** 답장 대상 메세지를 보낸 유저 ID */
  readonly src_userId: string;
  /** 답장 대상 메세지에서 멘션된 유저 ID 목록. 원본 멘션 객체의 `user_id`만 중복 없이 모았습니다. */
  readonly src_mentions?: string[];
}
