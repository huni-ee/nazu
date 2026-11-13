/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { Channel } from '../channel/channel.js';
import type {
  DeleteFeedChat,
  EditFeedChat,
  FeedChat,
  HideFeedChat,
  InviteFeedChat,
  JoinFeedChat,
  KickFeedChat,
  LeaveFeedChat,
  MemberTypeChangeFeedChat
} from '../chat/feed.js';
import type { MessageChat } from '../chat/message.js';

/** `error` 이벤트로 전달되는 오류 정보입니다. */
export type ErrorContext = {
  /** 오류가 난 이벤트 이름입니다. 연결 중 오류는 `connect`입니다. */
  readonly event: string;
  /** 오류가 난 리스너 함수입니다. 리스너 밖에서 난 오류는 `null`입니다. */
  readonly func: unknown;
  /** 발생한 오류입니다. */
  readonly exception: unknown;
  /** 오류가 났을 때 리스너에 전달된 인자입니다. */
  readonly args: readonly unknown[];
};

/** `open_profile_change` 이벤트에서 변경 전후의 오픈프로필입니다. */
export type OpenProfileChangeUser = {
  /** 유저 ID입니다. */
  readonly id: string;
  /** 프로필 이름입니다. */
  readonly name: string;
  /** 프로필 이미지 주소입니다. 없으면 `null`입니다. */
  readonly profileImageUrl: string | null;
};

/** 오픈프로필에서 바뀐 항목입니다. 이름과 이미지가 모두 바뀌면 두 메서드가 모두 `true`입니다. */
export type OpenProfileChange = {
  /** 프로필 이름이 바뀌었으면 `true`를 반환합니다. */
  isNickname(): boolean;
  /** 프로필 이미지 주소가 바뀌었으면 `true`를 반환합니다. */
  isProfileImage(): boolean;
};

/** `message` 이벤트 리스너입니다. 메세지가 도착하면 호출합니다. */
export type MessageListener = (chat: MessageChat, channel: Channel) => void | Promise<void>;

/**
 * `error` 이벤트 리스너입니다. 이벤트 처리나 연결 중 오류가 나면 호출합니다.
 * 오류 리스너가 없거나 리스너 안에서 다시 오류가 나면 콘솔에 출력합니다.
 */
export type ErrorListener = (error: ErrorContext) => void | Promise<void>;

/**
 * `feed` 이벤트 리스너입니다. 입장, 퇴장, 삭제 같은 피드를 모두 받습니다.
 * 알 수 없는 피드는 `UnknownFeedChat`으로 전달합니다.
 */
export type FeedListener = (chat: FeedChat, channel: Channel) => void | Promise<void>;

/** `delete` 이벤트 리스너입니다. 메세지가 삭제되면 호출합니다. 삭제된 메세지의 원본을 찾지 못하면 호출하지 않습니다. */
export type DeleteListener = (chat: DeleteFeedChat, channel: Channel) => void | Promise<void>;

/** `edit` 이벤트 리스너입니다. 메세지가 수정되면 호출합니다. 수정 전 메세지를 찾지 못하면 호출하지 않습니다. */
export type EditListener = (chat: EditFeedChat, channel: Channel) => void | Promise<void>;

/** `hide` 이벤트 리스너입니다. 방장이나 부방장이 메세지를 가리면 호출합니다. */
export type HideListener = (chat: HideFeedChat, channel: Channel) => void | Promise<void>;

/** `join` 이벤트 리스너입니다. 오픈채팅방에 유저가 들어오면 호출합니다. */
export type JoinListener = (chat: JoinFeedChat, channel: Channel) => void | Promise<void>;

/** `invite` 이벤트 리스너입니다. 일반 채팅방에 유저가 초대되면 호출합니다. */
export type InviteListener = (chat: InviteFeedChat, channel: Channel) => void | Promise<void>;

/** `leave` 이벤트 리스너입니다. 유저가 채팅방을 나가면 호출합니다. */
export type LeaveListener = (chat: LeaveFeedChat, channel: Channel) => void | Promise<void>;

/** `kick` 이벤트 리스너입니다. 유저가 강퇴되면 호출합니다. */
export type KickListener = (chat: KickFeedChat, channel: Channel) => void | Promise<void>;

/** `member_type_change` 이벤트 리스너입니다. 방장이 바뀌거나 부방장이 임명·해제되면 호출합니다. */
export type MemberTypeChangeListener = (chat: MemberTypeChangeFeedChat, channel: Channel) => void | Promise<void>;

/**
 * `open_profile_change` 이벤트 리스너입니다. 오픈프로필 이름이나 이미지가 바뀌면 호출합니다.
 *
 * 리스너가 있는 동안 {@link ArisaClientOptions.openProfileIntervalMs} 간격으로 프로필을 확인합니다.
 * 확인 사이에 여러 번 바뀌면 중간 변경은 놓칠 수 있습니다.
 */
export type OpenProfileChangeListener = (
  beforeUser: OpenProfileChangeUser,
  afterUser: OpenProfileChangeUser,
  channel: Channel,
  change: OpenProfileChange
) => void | Promise<void>;
