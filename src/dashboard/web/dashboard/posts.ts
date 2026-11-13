/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { api } from '../utils/api.js';
import { safeImageUrl } from '../utils/profile.js';
import type { Post, PostOwner } from './types.js';
import { errorMessageOf } from './errors.js';
import { state } from './state.js';
import { showImageViewer } from './views.js';

const FRIEND_POST_TYPES = [
  { type: 0, label: '일반 게시물' },
  { type: 1, label: '프로필 사진' },
  { type: 2, label: '배경 사진' },
  { type: 3, label: '상태 메세지' },
  { type: 4, label: '디데이' },
  { type: 5, label: '음악' },
  { type: 6, label: '숏폼' },
  { type: 7, label: '카카오스토리' }
];

export function friendPostContent(post: Post | null | undefined) {
  if (!post || typeof post !== 'object') return null;
  let imageUrl: unknown = '';
  let text = '';
  if ([0, 1, 2, 6, 7].includes(post.type)) imageUrl = post.thumbnailUrl;
  else if (post.type === 3) {
    text = typeof post.statusMessage === 'string' ? post.statusMessage : '';
    imageUrl = post.profileImageUrl;
  } else if (post.type === 4) {
    imageUrl = post.backgroundUrl;
    text = [post.subject, post.date].filter((value) => typeof value === 'string' && value.trim()).join('\n');
  } else if (post.type === 5) {
    imageUrl = post.albumImageUrl;
    const artists = Array.isArray(post.artists)
      ? post.artists.filter((value) => typeof value === 'string' && value.trim()).join(', ')
      : '';
    text = [post.title, artists].filter((value) => typeof value === 'string' && value.trim()).join('\n');
  }
  return {
    imageUrl: safeImageUrl(imageUrl),
    text,
    label: FRIEND_POST_TYPES.find(({ type }) => type === post.type)?.label || '게시물'
  };
}

export function postOwner(profileData: unknown, friendId: string | null): PostOwner {
  const isSelf = friendId === null;
  return {
    profileData,
    friendId,
    isSelf,
    version: state.friendsVersion,
    selectedFriendKey: state.selectedFriendKey,
    path: isSelf ? '/me/posts' : `/friends/${encodeURIComponent(friendId)}/posts`,
    cache: isSelf ? state.selfPosts : state.friendPosts,
    filterKey: isSelf ? 'me' : friendId
  };
}

export function isPostOwnerCurrent(owner: PostOwner) {
  return owner.isSelf
    ? state.selfProfile?.profile === owner.profileData
    : owner.friendId !== null &&
        owner.version === state.friendsVersion &&
        state.friendProfiles.get(owner.friendId) === owner.profileData;
}

export function isPostOwnerSelected(owner: PostOwner) {
  return (
    state.tab === 'friends' &&
    (owner.isSelf ? state.selectedSelf : !state.selectedSelf && state.selectedFriendKey === owner.selectedFriendKey)
  );
}

function friendPostDetailContent(post: Post | null | undefined) {
  const content = post?.content;
  if (!post || !content || typeof content !== 'object') return null;
  const summary = friendPostContent({ ...post, ...content });
  let images: string[] = [];
  let text = summary?.text || '';
  if ([0, 7].includes(post.type)) {
    images = Array.isArray(content.media)
      ? content.media.map((media) => safeImageUrl(media?.videoPreviewImageUrl) || safeImageUrl(media?.resourceUrl))
      : [];
    text = typeof content.description === 'string' ? content.description : '';
  } else if ([1, 2].includes(post.type)) {
    images = [
      safeImageUrl(content.videoPreviewImageUrl) ||
        safeImageUrl(post.type === 1 ? content.profileUrl : content.backgroundUrl)
    ];
    text = typeof content.description === 'string' ? content.description : '';
  } else if (summary?.imageUrl) images = [summary.imageUrl];
  return { images: images.filter(Boolean), text, createdAt: post.createdAt };
}

export async function showFriendPostDetail(post: Post, trigger: HTMLElement | null, owner: PostOwner) {
  const content = friendPostContent(post);
  if (!content || (!content.imageUrl && !content.text.trim())) return;
  const postId = typeof post.postId === 'string' || Number.isSafeInteger(post.postId) ? String(post.postId) : '';
  const canLoad =
    (owner.isSelf || /^[1-9]\d*$/.test(String(owner.friendId))) && /^[1-9]\d*$/.test(postId) && post.type !== 6;
  const viewer = showImageViewer(content.imageUrl, `${content.label} 상세 보기`, {
    text: content.text,
    createdAt: post.createdAt,
    loading: canLoad,
    trigger
  });
  if (!canLoad || !viewer) return;
  const key = owner.isSelf ? postId : `${owner.friendId}:${postId}`;
  let pending = owner.cache.get(key);
  if (!pending) {
    pending = api<{ post?: Post }>(`${owner.path}/${encodeURIComponent(postId)}`).then((result) => {
      if (String(result.post?.postId) !== postId) throw new Error('게시물 정보가 올바르지 않습니다.');
      const detail = friendPostDetailContent(result.post);
      if (!detail || (!detail.images.length && !detail.text.trim()))
        throw new Error('게시물 내용을 표시할 수 없습니다.');
      return detail;
    });
    owner.cache.set(key, pending);
  }
  try {
    const detail = await pending;
    if (isPostOwnerCurrent(owner)) viewer.setContent(detail);
    else
      viewer.setStatus(
        owner.isSelf
          ? '내 프로필이 새로고침되었습니다. 게시물을 다시 열어 주세요.'
          : '친구 목록이 새로고침되었습니다. 게시물을 다시 열어 주세요.'
      );
  } catch (error) {
    if (owner.cache.get(key) === pending) owner.cache.delete(key);
    viewer.setStatus(errorMessageOf(error) || '게시물 상세 내용을 불러올 수 없습니다.');
  }
}
