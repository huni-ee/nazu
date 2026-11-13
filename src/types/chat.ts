/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { ChannelRaw } from './channel.js';
import type { UserRaw } from './user.js';

/** 메세지가 속한 범위입니다. */
export type MessageScopeName = 'unknown' | 'channel' | 'thread' | 'all';

/**
 * 메세지 첨부 데이터입니다. 키는 카카오톡이 보낸 원본 그대로이며, 아래에 없는 키가 더 있을 수 있습니다.
 * 메세지 종류별 첨부 데이터는 이 타입을 확장합니다.
 */
export interface Attachment extends Record<string, unknown> {
  /** 외치기 메세지이면 `true`입니다. */
  readonly shout?: boolean;
  /** 멘션된 유저 ID 목록입니다. */
  readonly mentions?: {
    /** 멘션된 유저 ID입니다. */
    readonly user_id: string;
  }[];
  /** 메세지에 들어 있는 URL 목록입니다. */
  readonly urls?: string[];
}

/** 메세지 수정 기록 한 건입니다. */
export interface MessageRevisionRaw {
  /** 수정 번호입니다. */
  readonly revision: number;
  /** 이 수정에서의 메세지 내용입니다. */
  readonly message: string;
}

/** 메세지 원본 데이터입니다. */
export interface MessageChatRaw {
  /** 메세지 로그 ID입니다. */
  readonly logId: string;
  /** 스레드 ID입니다. 스레드에 속하지 않으면 `null`입니다. */
  readonly threadId: string | null;
  /** 원본 메세지 타입 번호입니다. */
  readonly type: number;
  /** 메세지가 속한 범위입니다. */
  readonly scope: MessageScopeName;
  /** 메세지 내용입니다. */
  readonly message: string;
  /** 첨부 데이터입니다. */
  readonly attachment: Attachment;
  /** 수정 기록입니다. */
  readonly modifyLog: MessageRevisionRaw[];
  /** 보낸 유저입니다. 유저 정보가 없으면 `null`입니다. */
  readonly user: UserRaw | null;
  /** 메세지가 온 채팅방입니다. */
  readonly channel: ChannelRaw;
}

/** 멘션이 있는 메세지의 첨부 데이터입니다. */
export interface MentionAttachment extends Attachment {
  /** 멘션된 유저 ID 목록입니다. */
  readonly mentions?: {
    /** 멘션된 유저 ID입니다. */
    readonly user_id: string;
  }[];
}

/** 사진 메세지의 첨부 데이터입니다. */
export interface PhotoAttachment extends Attachment {
  /** 원본 값입니다. */
  readonly cmt?: string;
  /** 원본 값입니다. */
  readonly cs: string;
  /** 원본 값입니다. */
  readonly expire: number;
  /** 원본 사진 높이입니다. */
  readonly h: number;
  /** 원본 값입니다. */
  readonly k: string;
  /** 원본 값입니다. */
  readonly mt: string;
  /** 원본 값입니다. */
  readonly s: number;
  /** 미리보기 높이입니다. */
  readonly thumbnailHeight: number;
  /** 미리보기 이미지 주소입니다. */
  readonly thumbnailUrl: string;
  /** 미리보기 너비입니다. */
  readonly thumbnailWidth: number;
  /** 사진 주소입니다. */
  readonly url: string;
  /** 원본 사진 너비입니다. */
  readonly w: number;
}

/** 동영상 메세지의 첨부 데이터입니다. */
export interface VideoAttachment extends Attachment {
  /** 원본 값입니다. */
  readonly cmt?: string;
  /** 원본 값입니다. */
  readonly cs: string;
  /** 원본 값입니다. */
  readonly csh?: string;
  /** 원본 값입니다. */
  readonly d: number;
  /** 원본 값입니다. */
  readonly dh?: number;
  /** 원본 값입니다. */
  readonly expire: number;
  /** 동영상 높이입니다. */
  readonly h: number;
  /** 원본 값입니다. */
  readonly hh?: number;
  /** 원본 값입니다. */
  readonly s: number;
  /** 원본 값입니다. */
  readonly sh?: number;
  /** 원본 값입니다. */
  readonly tk: string;
  /** 원본 값입니다. */
  readonly tkh?: string;
  /** 동영상 주소입니다. */
  readonly url: string;
  /** 원본 값입니다. */
  readonly urlh?: string;
  /** 동영상 너비입니다. */
  readonly w: number;
  /** 원본 값입니다. */
  readonly wh?: number;
}

/** 음성 메세지의 첨부 데이터입니다. */
export interface AudioAttachment extends Attachment {
  /** 원본 값입니다. */
  readonly d: number;
  /** 원본 값입니다. */
  readonly expire: number;
  /** 원본 값입니다. */
  readonly k: string;
  /** 원본 값입니다. */
  readonly s: number;
  /** 음성 파일 주소입니다. */
  readonly url: string;
}

/** 이모티콘 메세지의 첨부 데이터입니다. */
export interface EmoticonAttachment extends Attachment {
  /** 이모티콘 대체 텍스트입니다. */
  readonly alt: string;
  /** 원본 값입니다. */
  readonly height?: string | number;
  /** 원본 값입니다. */
  readonly msg?: string;
  /** 이모티콘 이름입니다. */
  readonly name: string;
  /** 이모티콘 경로입니다. */
  readonly path: string;
  /** 원본 값입니다. */
  readonly sound?: string;
  /** 원본 값입니다. */
  readonly type?: string;
  /** 원본 값입니다. */
  readonly welcome?: boolean;
  /** 원본 값입니다. */
  readonly width?: string | number;
  /** 원본 값입니다. */
  readonly s?: string | number;
  /** 원본 값입니다. */
  readonly xconVersion?: string | number;
}

/** 미니 이모티콘이 들어 있는 메세지의 첨부 데이터입니다. */
export interface MiniEmoticonAttachment {
  /** 메세지 안의 미니 이모티콘 목록입니다. */
  readonly items: {
    /** 원본 값입니다. */
    readonly at: number[];
    /** 원본 값입니다. */
    readonly id: string;
    /** 원본 값입니다. */
    readonly len: number;
  }[];
  /** 원본 항목 수 값입니다. */
  readonly total_item: number;
  /** 원본 길이 값입니다. */
  readonly total_len: number;
}

/** 지도 메세지의 첨부 데이터입니다. */
export interface MapAttachment extends Attachment {
  /** 원본 값입니다. */
  readonly a: string;
  /** 원본 값입니다. */
  readonly c: boolean;
  /** 위도입니다. */
  readonly lat: number;
  /** 경도입니다. */
  readonly lng: number;
  /** 원본 값입니다. */
  readonly t?: string;
}

/** 프로필 공유 메세지의 첨부 데이터입니다. */
export interface ProfileAttachment extends Attachment {
  /** 원본 접근 허용 값입니다. */
  readonly accessPermit: string;
  /** 계정 ID입니다. */
  readonly accountId: string;
  /** 닉네임입니다. */
  readonly nickName: string;
  /** 상태 메세지입니다. */
  readonly statusMessage?: string;
  /** 유저 ID입니다. */
  readonly userId: string;
  /** 원본 유저 타입 값입니다. */
  readonly userType: number;
}

/** 파일 메세지의 첨부 데이터입니다. */
export interface FileAttachment extends Attachment {
  /** 원본 값입니다. */
  readonly cs: string;
  /** 원본 값입니다. */
  readonly expire: number;
  /** 원본 값입니다. */
  readonly k: string;
  /** 파일 이름입니다. */
  readonly name: string;
  /** 원본 값입니다. */
  readonly s: number;
  /** 파일 크기입니다. */
  readonly size: number;
  /** 파일 주소입니다. */
  readonly url: string;
}

/** 여러 장의 사진을 묶은 메세지의 첨부 데이터입니다. */
export interface MultiPhotoAttachment extends Attachment {
  /** 원본 값 목록입니다. */
  readonly cmtl: string[];
  /** 원본 값 목록입니다. */
  readonly csl: string[];
  /** 원본 값입니다. */
  readonly ctMeta?: string;
  /** 원본 값입니다. */
  readonly expire: number;
  /** 원본 값 목록입니다. */
  readonly hl: number[];
  /** 사진 주소 목록입니다. */
  readonly imageUrls: string[];
  /** 원본 값 목록입니다. */
  readonly kl: string[];
  /** 원본 값입니다. */
  readonly lastFeedId?: string;
  /** 원본 값 목록입니다. */
  readonly mtl: string[];
  /** 원본 값 목록입니다. */
  readonly sl: number[];
  /** 미리보기 높이 목록입니다. */
  readonly thumbnailHeights: number[];
  /** 미리보기 이미지 주소 목록입니다. */
  readonly thumbnailUrls: string[];
  /** 미리보기 너비 목록입니다. */
  readonly thumbnailWidths: number[];
  /** 원본 값 목록입니다. */
  readonly wl: number[];
}

/** 답장 메세지의 첨부 데이터입니다. `src_`로 시작하는 키는 답장 대상 메세지의 정보입니다. */
export interface ReplyAttachment extends Attachment {
  /** 원본 값입니다. */
  readonly attach_only?: boolean;
  /** 답장에 붙은 이모티콘 데이터입니다. */
  readonly attach_content?: EmoticonAttachment;
  /** 원본 값입니다. */
  readonly attach_type?: number;
  /** 원본 값입니다. */
  readonly src_linkId: string;
  /** 답장 대상 메세지의 로그 ID입니다. `getSource()`가 이 값으로 메세지를 찾습니다. */
  readonly src_logId: string;
  /** 답장 대상 메세지 내용입니다. */
  readonly src_message: string;
  /** 답장 대상 메세지 타입 번호입니다. */
  readonly src_type: number;
  /** 답장 대상 메세지를 보낸 유저 ID입니다. */
  readonly src_userId: string;
  /** 답장 대상 메세지의 멘션 목록입니다. */
  readonly src_mentions?: string[];
}
