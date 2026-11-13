/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

export const OPEN_CHANNEL_TYPES = new Set(['OD', 'OM', 'COM']);
const GROUP_CHANNEL_TYPES = new Set(['MULTICHAT', 'TEAMMULTICHAT', 'OM', 'COM']);

export function channelAvatarFallback(type: string) {
  return GROUP_CHANNEL_TYPES.has(type.trim().toUpperCase()) ? 'users' : 'user';
}

export const CHANNEL_TYPE_LABELS = new Map([
  ['MemoChat', '나와의 채팅'],
  ['DirectChat', '1:1 채팅'],
  ['MultiChat', '그룹 채팅'],
  ['TeamMultiChat', '팀채팅'],
  ['PlusChat', '채널'],
  ['OD', '1:1 오픈채팅'],
  ['OM', '그룹 오픈채팅'],
  ['COM', '커뮤니티 오픈채팅']
]);
