/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { isLongId } from '../../../utils/id/index.js';
import { HttpError, readJsonBody, requireDashboardHeader, sendJson } from '../http.js';
import { roleIds, saveKnownNames } from '../role-store.js';
import { dashboardSelfName, readDashboardRoomSelfProfile } from '../self-profile.js';
import type { DashboardChannel, DashboardToolUser, RouteContext } from '../types.js';
import { isSafeId, isSafeName, profileImageUrl } from '../validation.js';

async function readDirectNames(
  channels: readonly DashboardChannel[],
  names: Map<string, string>,
  signal: AbortSignal
): Promise<void> {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, channels.length) }, async () => {
      while (!signal.aborted) {
        const channel = channels[index++];
        if (!channel) return;
        try {
          const members = await channel.members;
          signal.throwIfAborted();
          const peer = members.find(
            (member): member is DashboardToolUser & { readonly name: string } =>
              !member.isMine() && isSafeName(member.name)
          );
          if (peer) names.set(channel.id, peer.name.trim());
        } catch {
          // 한 방의 멤버 조회가 실패해도 다른 방 이름은 계속 조회한다.
        }
      }
    })
  );
}

async function readOpenDirectImages(
  channels: readonly DashboardChannel[],
  images: Map<string, string>,
  signal: AbortSignal
): Promise<void> {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, channels.length) }, async () => {
      while (!signal.aborted) {
        const channel = channels[index++];
        if (!channel) return;
        try {
          const members = await channel.members;
          signal.throwIfAborted();
          const peers = members.filter((member) => !member.isMine());
          if (peers.length !== 1) continue;
          const image = profileImageUrl(peers[0]?.profileImageUrl);
          if (image) images.set(channel.id, image);
        } catch {
          // 상대 프로필을 가져오지 못한 방은 기본 이미지를 사용한다.
        }
      }
    })
  );
}

/** 홈 도구의 메세지 전송과 읽음 처리 요청을 채팅방에 전달한다. */
async function sendChannelAction(
  { request, response, client }: RouteContext,
  channelId: string,
  action: string | undefined
): Promise<void> {
  if (!isLongId(channelId)) throw new HttpError(400, '채팅방 ID가 올바르지 않습니다.');
  requireDashboardHeader(request);
  const body = await readJsonBody(request, 1024 * 1024);
  const channel = await client.getChannel(channelId);
  if (action === 'messages') {
    if (typeof body.text !== 'string' || !body.text.trim()) throw new HttpError(400, '전송할 메세지를 입력하세요.');
    if (body.threadId !== undefined && !isLongId(body.threadId))
      throw new HttpError(400, '스레드 ID가 올바르지 않습니다.');
    await channel.send(body.text, typeof body.threadId === 'string' ? body.threadId : undefined);
  } else {
    await channel.read();
  }
  sendJson(response, 200, { queued: true, channelId });
}

/** 채팅방 목록, 멤버 목록, 메세지 전송과 읽음 처리 */
export async function handleChannelRoute(context: RouteContext): Promise<boolean> {
  const { request, response, url, client } = context;
  const pathname = url.pathname;
  const actionMatch = /^\/api\/channels\/([1-9]\d*)\/(messages|read)$/.exec(pathname);
  if (request.method === 'POST' && actionMatch !== null) {
    try {
      await sendChannelAction(context, actionMatch[1] ?? '', actionMatch[2]);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, '채팅방 요청에 실패했습니다. 채팅방 ID와 Arisa 연결을 확인하세요.');
    }
    return true;
  }
  if (request.method === 'GET' && pathname === '/api/channels') {
    let channels;
    let memberCounts;
    try {
      [channels, memberCounts] = await Promise.all([client.listChannels(), client.getChannelMemberCounts()]);
    } catch {
      throw new HttpError(503, '채팅방 목록을 가져올 수 없습니다. Arisa 연결을 확인하세요.');
    }
    let ownOpenProfiles = null;
    let ownDirectOpenChats = null;
    let profileChannelLinks = new Map<string, string>();
    let profileHomeChannelIds = new Set<string>();
    let directChannelLinks = new Map<string, string>();
    let directHomeChannelIds = new Set<string>();
    const accountId = client.getAccountId();
    if (accountId !== null) {
      try {
        [ownOpenProfiles, profileChannelLinks] = await Promise.all([
          client.getOwnOpenProfiles(accountId),
          client.getOwnOpenProfileChannelLinks(accountId)
        ]);
      } catch {
        // 채팅 목록은 유지하고 프로필 분류만 사용 불가로 표시한다.
      }
      try {
        profileHomeChannelIds = await client.getOwnOpenProfileHomeChannelIds(accountId);
      } catch {
        // 홈 항목을 확인하지 못하면 기존 채팅 목록을 그대로 유지한다.
      }
      try {
        const [directChats, directChannels] = await Promise.all([
          client.getOwnDirectOpenChats(accountId),
          client.getOwnDirectOpenChatChannels(accountId)
        ]);
        ownDirectOpenChats = directChats;
        directChannelLinks = directChannels.links;
        const directIds = new Set(directChats.map((chat) => chat.id));
        directHomeChannelIds = new Set(
          [...directChannels.homeChannelIds].filter((channelId) =>
            directIds.has(directChannelLinks.get(channelId) ?? '')
          )
        );
      } catch {
        // 분류 조회가 실패하면 채팅방 목록을 그대로 유지한다.
      }
    }
    const ownOpenProfileIds = new Set(ownOpenProfiles?.map((profile) => profile.id));
    const ownDirectOpenChatIds = new Set(ownDirectOpenChats?.map((chat) => chat.id));
    const visibleChannels = channels.filter(
      (channel) => !profileHomeChannelIds.has(channel.id) && !directHomeChannelIds.has(channel.id)
    );
    const directImages = new Map<string, string>();
    const imageFallbackChannels = visibleChannels.filter(
      (channel) => channel.type === 'OD' && !channel.openChannel?.imageUrl
    );
    if (imageFallbackChannels.length > 0) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          readOpenDirectImages(imageFallbackChannels, directImages, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error('open direct image lookup timed out'));
            }, 2_000);
          })
        ]);
      } catch {
        // 일부 이미지 조회가 늦어져도 채팅 목록은 반환한다.
      } finally {
        clearTimeout(timer);
      }
    }
    const directNames = new Map<string, string>();
    const unnamedDirectChannels = channels.filter(
      (channel) => channel.type === 'DirectChat' && !channel.privateName?.trim() && !channel.name?.trim()
    );
    if (unnamedDirectChannels.length > 0) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          readDirectNames(unnamedDirectChannels, directNames, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new Error('channel name lookup timed out'));
            }, 10_000);
          })
        ]);
      } catch {
        // 이름 조회에 실패해도 채팅방 목록은 반환한다.
      } finally {
        clearTimeout(timer);
      }
    }
    sendJson(response, 200, {
      ownOpenProfiles,
      ownDirectOpenChats,
      channels: visibleChannels.map((channel) => ({
        id: channel.id,
        name:
          [channel.privateName, channel.name].find((name) => name?.trim()) ||
          (channel.type === 'DirectChat' ? directNames.get(channel.id) : undefined) ||
          `채팅방 ${channel.id}`,
        type: channel.type,
        ownOpenProfileId:
          channel.type === 'OD' && ownOpenProfileIds.has(profileChannelLinks.get(channel.id) ?? '')
            ? profileChannelLinks.get(channel.id)
            : null,
        ownDirectOpenChatId:
          channel.type === 'OD' && ownDirectOpenChatIds.has(directChannelLinks.get(channel.id) ?? '')
            ? directChannelLinks.get(channel.id)
            : null,
        profileImageUrl: channel.openChannel?.imageUrl || directImages.get(channel.id) || null,
        memberCount: memberCounts.get(channel.id) ?? null,
        openChannel: channel.openChannel
          ? { url: channel.openChannel.url, description: channel.openChannel.description }
          : null
      }))
    });
    return true;
  }
  const membersMatch = /^\/api\/channels\/([^/]+)\/members$/.exec(pathname);
  if (request.method === 'GET' && membersMatch !== null) {
    let channelId: string;
    try {
      channelId = decodeURIComponent(membersMatch[1] ?? '');
    } catch {
      throw new HttpError(400, '채팅방 ID가 올바르지 않습니다.');
    }
    if (!isSafeId(channelId)) throw new HttpError(400, '채팅방 ID가 올바르지 않습니다.');
    let members;
    let channel: DashboardChannel;
    try {
      channel = await client.getChannel(channelId);
      members = await channel.members;
    } catch {
      throw new HttpError(503, '멤버 목록을 불러올 수 없습니다. 다시 시도해 주세요.');
    }
    const database = client.getDatabase();
    const admins = roleIds(database, 'admin');
    const banned = roleIds(database, 'ban');
    const hasChannelRoles = ['OD', 'OM', 'COM', 'TeamMultiChat'].includes(channel.type);
    const accountId = client.getAccountId();
    const selfProfile = await readDashboardRoomSelfProfile(client, channelId, accountId);
    saveKnownNames(
      database,
      members.map((member) => {
        const self = accountId !== null ? member.id === accountId : member.isMine();
        const fallback = self ? dashboardSelfName(member.name, client.botName) : member.name;
        return {
          id: member.id,
          // 봇 설정값 대신 쓰는 '나'는 실제 닉네임이 아니므로 레이블로 저장하지 않는다.
          name: self && selfProfile?.name ? selfProfile.name : self && fallback !== member.name ? null : fallback
        };
      }),
      admins,
      banned
    );
    sendJson(response, 200, {
      members: members.map((member) => {
        const self = accountId !== null ? member.id === accountId : member.isMine();
        return {
          id: member.id,
          name: self ? (selfProfile?.name ?? dashboardSelfName(member.name, client.botName)) : member.name,
          profileImageUrl: self ? (selfProfile?.image ?? member.profileImageUrl) : member.profileImageUrl,
          host: hasChannelRoles && member.isHost(),
          moderator: hasChannelRoles && member.isModerator(),
          isBot: member.isBotUser() || member.raw.memberType === 'bot' || member.raw.openChannel?.memberType === 'bot',
          admin: admins.has(member.id),
          banned: banned.has(member.id)
        };
      })
    });
    return true;
  }
  return false;
}
