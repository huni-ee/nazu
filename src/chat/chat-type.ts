/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

export const MessageKind = {
  normal: 1,
  photo: 2,
  video: 3,
  audio: 5,
  emoticon: 12,
  map: 16,
  profile: 17,
  file: 18,
  animatedEmoticon: 20,
  gifEmoticon: 25,
  reply: 26,
  multiPhoto: 27
} as const;

export const FeedKind = {
  invite: 1,
  leave: 2,
  join: 4,
  kick: 6,
  promote: 11,
  demote: 12,
  delete: 14,
  handover: 15,
  bot: 23,
  edit: 25,
  hide: 26
} as const;

const deletedFlag = 0x4000;

export function baseMessageType(value: number): number {
  return value & ~deletedFlag;
}
