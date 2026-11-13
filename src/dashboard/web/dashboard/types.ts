/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { createConnectionMonitor } from '../utils/connection.js';
import type { createProfileSwitcher } from '../utils/profile-switcher.js';
import type { normalizeChannel, normalizeMember, normalizeSelfProfile, normalizeFriend } from './data.js';

export type Channel = NonNullable<ReturnType<typeof normalizeChannel>>;
export type Member = NonNullable<ReturnType<typeof normalizeMember>>;
export type Friend = ReturnType<typeof normalizeFriend>;
export type Self = ReturnType<typeof normalizeSelfProfile>;
export type OpenGroup = {
  id?: unknown;
  name?: string;
  groupKind: 'profile' | 'direct';
  imageUrl?: string;
  profileImageUrl?: string;
};
export type UpdatedProfile = { userId?: unknown; updatedAt?: unknown };
export type RoleEntry = { id: string; name?: string };
export type RawChannel = NonNullable<Parameters<typeof normalizeChannel>[0]>;
export type RawMember = NonNullable<Parameters<typeof normalizeMember>[0]>;
export type RawFriend = NonNullable<Parameters<typeof normalizeFriend>[0]> & {
  userType?: unknown;
  purged?: unknown;
  isPurged?: unknown;
};
export type SelfProfile = NonNullable<Parameters<typeof normalizeSelfProfile>[0]>;
export type ChannelPayload = {
  channels?: RawChannel[];
  ownOpenProfiles?: OpenGroup[] | null;
  ownDirectOpenChats?: OpenGroup[] | null;
};
export type FriendsPayload = {
  sync?: { friends?: RawFriend[] };
  createdAt?: { createdAt?: Record<string, unknown> };
  updated?: { users?: UpdatedProfile[] };
  birthday?: { birthday_friends?: { month_day_to_birthday_details?: Record<string, unknown[]> } };
};
export type RolesPayload = { admins?: unknown; banned?: unknown };
type PostMedia = { videoPreviewImageUrl?: unknown; resourceUrl?: unknown };
type PostContent = {
  thumbnailUrl?: unknown;
  statusMessage?: unknown;
  profileImageUrl?: unknown;
  backgroundUrl?: unknown;
  subject?: unknown;
  date?: unknown;
  albumImageUrl?: unknown;
  artists?: unknown[];
  title?: unknown;
  videoPreviewImageUrl?: unknown;
  profileUrl?: unknown;
  description?: unknown;
  media?: PostMedia[];
};
export type Post = PostContent & { type: number; postId?: unknown; createdAt?: number; content?: PostContent };
export type PostDetail = { images: string[]; text: string; createdAt?: number };
export type PostOwner = {
  profileData: unknown;
  friendId: string | null;
  isSelf: boolean;
  version: number;
  selectedFriendKey: string | null;
  path: string;
  cache: Map<string, Promise<PostDetail>>;
  filterKey: string | null;
};

export type SwitcherOptions = Parameters<typeof createProfileSwitcher>[0];
export type ConnectionsPayload = Awaited<ReturnType<SwitcherOptions['requestConnections']>>;
export type ConnectionUpdate = Awaited<ReturnType<SwitcherOptions['onConnectionAction']>>;
export type MonitorOptions = Parameters<typeof createConnectionMonitor>[0];
export type ConnectionStatus = Awaited<ReturnType<MonitorOptions['requestStatus']>>;
export type ConnectionState = Parameters<NonNullable<MonitorOptions['onChange']>>[0]['state'];
