/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { safeImageUrl } from '../utils/profile.js';
import { compareNames } from '../utils/name-order.js';

type RawChannel = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  profileImageUrl?: unknown;
  openChannel?: unknown;
  ownOpenProfileId?: unknown;
  ownDirectOpenChatId?: unknown;
  memberCount?: unknown;
};
type RawMember = {
  id?: unknown;
  name?: unknown;
  profileImageUrl?: unknown;
  admin?: unknown;
  banned?: unknown;
  host?: unknown;
  moderator?: unknown;
  isBot?: unknown;
};
type RawFriend = {
  userId?: unknown;
  friendNickName?: unknown;
  nickName?: unknown;
  profileImageUrl?: unknown;
  statusMessage?: unknown;
  phoneNumber?: unknown;
  favorite?: unknown;
  hidden?: unknown;
  suspended?: unknown;
  memorial?: unknown;
};
type RawProfile = {
  userId?: unknown;
  statusMessage?: { message?: unknown } | string | null;
  nickname?: unknown;
  profileImage?: { mediumUrl?: unknown; originalUrl?: unknown } | null;
};
type RawSelfProfile = {
  profile?: RawProfile | null;
  main?: { nickname?: unknown; originalProfileImageUrl?: unknown; statusMessage?: unknown } | null;
};
type NameAndId = { name: string; id: string };
type Room = { name?: unknown; id?: unknown };
type Channel = Room & { type: string };
type OpenGroup = Room & { name?: string; groupKind?: string };
type Member = NameAndId & { host?: boolean; moderator?: boolean; isBot?: boolean };
type RoleEntry = { id: string; name?: string };

const friendIdCollator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
const channelTypeOrder = new Map([
  ['DIRECTCHAT', 0],
  ['MULTICHAT', 1],
  ['TEAMMULTICHAT', 2],
  ['OD', 0],
  ['OM', 1],
  ['COM', 2]
]);

export function normalizeId(value: unknown) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

export function fallbackName(id: string) {
  return id ? `유저 ${id}` : '알 수 없는 유저';
}

export function normalizeChannel(entry: RawChannel | null | undefined) {
  const id = normalizeId(entry?.id);
  if (!id || !entry) return null;
  return {
    id,
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : `채팅방 ${id}`,
    type: typeof entry.type === 'string' ? entry.type : String(entry.type ?? ''),
    profileImageUrl: entry.profileImageUrl,
    openChannel: entry.openChannel,
    ownOpenProfileId: normalizeId(entry.ownOpenProfileId) || null,
    ownDirectOpenChatId: normalizeId(entry.ownDirectOpenChatId) || null,
    memberCount:
      typeof entry.memberCount === 'number' && Number.isSafeInteger(entry.memberCount) && entry.memberCount >= 0
        ? entry.memberCount
        : null
  };
}

export function normalizeMember(entry: RawMember | null | undefined) {
  const id = normalizeId(entry?.id);
  if (!id || !entry) return null;
  return {
    id,
    name: typeof entry.name === 'string' && entry.name.trim() ? entry.name : fallbackName(id),
    profileImageUrl: entry.profileImageUrl,
    admin: entry.admin === true,
    banned: entry.banned === true,
    host: entry.host === true,
    moderator: entry.moderator === true,
    isBot: entry.isBot === true
  };
}

function normalizeMe(entry: (RawMember & { statusMessage?: unknown }) | null | undefined) {
  if (!entry || typeof entry !== 'object') return null;
  const id = normalizeId(entry.id);
  const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name : '내 계정';
  return {
    id,
    name,
    profileImageUrl: entry.profileImageUrl,
    statusMessage: typeof entry.statusMessage === 'string' ? entry.statusMessage : ''
  };
}

export function normalizeSelfProfile(result: RawSelfProfile | null | undefined) {
  const profileData = result?.profile;
  const main = result?.main;
  if (!profileData || !main || !normalizeId(profileData.userId)) throw new Error('내 프로필 형식이 올바르지 않습니다.');
  const statusMessage =
    typeof profileData.statusMessage === 'object' && typeof profileData.statusMessage?.message === 'string'
      ? profileData.statusMessage.message
      : typeof profileData.statusMessage === 'string'
        ? profileData.statusMessage
        : main.statusMessage;
  return normalizeMe({
    id: profileData.userId,
    name:
      typeof profileData.nickname === 'string' && profileData.nickname.trim() ? profileData.nickname : main.nickname,
    profileImageUrl:
      safeImageUrl(profileData.profileImage?.mediumUrl) ||
      safeImageUrl(profileData.profileImage?.originalUrl) ||
      main.originalProfileImageUrl,
    statusMessage
  });
}

export function normalizeFriend(entry: RawFriend | null | undefined, index: number) {
  const id = normalizeId(entry?.userId) || `#${index + 1}`;
  const friendNickName = typeof entry?.friendNickName === 'string' ? entry.friendNickName : '';
  const nickName = typeof entry?.nickName === 'string' ? entry.nickName : '';
  const names = [friendNickName, nickName];
  const name = names.find((value) => value.trim()) ?? '';
  return {
    key: `friend:${id}:${index}`,
    id,
    name,
    friendNickName,
    nickName,
    profileImageUrl: entry?.profileImageUrl,
    statusMessage: typeof entry?.statusMessage === 'string' ? entry.statusMessage : '',
    phoneNumber: typeof entry?.phoneNumber === 'string' ? entry.phoneNumber : '',
    favorite: entry?.favorite === true,
    hidden: entry?.hidden === true,
    suspended: entry?.suspended === true,
    memorial: entry?.memorial === true,
    raw: entry
  };
}

export function compareFriends(left: NameAndId, right: NameAndId) {
  return compareNames(left.name, right.name) || friendIdCollator.compare(left.id, right.id);
}

export function compareRoomNames(left: Room, right: Room) {
  return (
    compareNames(String(left.name ?? ''), String(right.name ?? '')) ||
    friendIdCollator.compare(normalizeId(left.id), normalizeId(right.id))
  );
}

export function compareChannels(left: Channel, right: Channel) {
  const leftRank = channelTypeOrder.get(left.type.trim().toUpperCase()) ?? 3;
  const rightRank = channelTypeOrder.get(right.type.trim().toUpperCase()) ?? 3;
  return leftRank - rightRank || compareRoomNames(left, right);
}

export function compareOpenGroups(left: OpenGroup, right: OpenGroup) {
  const leftRank = left.groupKind === 'profile' ? 0 : 1;
  const rightRank = right.groupKind === 'profile' ? 0 : 1;
  const displayName = (entry: OpenGroup) =>
    entry.name || (entry.groupKind === 'profile' ? '이름 없는 오픈프로필' : '이름 없는 1:1 오픈채팅');
  return (
    leftRank - rightRank ||
    compareNames(displayName(left), displayName(right)) ||
    friendIdCollator.compare(normalizeId(left.id), normalizeId(right.id))
  );
}

export function compareMembers(left: Member, right: Member) {
  const rank = (member: Member) => (member.host ? 0 : member.moderator ? 1 : member.isBot ? 2 : 3);
  return rank(left) - rank(right) || compareFriends(left, right);
}

export function normalizeRoleEntries(entries: unknown, previous: Map<string, RoleEntry>) {
  const map = new Map<string, RoleEntry>();
  if (!Array.isArray(entries)) return map;
  for (const entry of entries as unknown[]) {
    const data = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : null;
    const id = normalizeId(data ? data.id : entry);
    if (!id) continue;
    const name = data && typeof data.name === 'string' && data.name.trim() ? data.name : previous.get(id)?.name;
    map.set(id, { id, name });
  }
  return map;
}
