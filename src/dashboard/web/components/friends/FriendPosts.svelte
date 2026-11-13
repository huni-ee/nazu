<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { onMount, onDestroy, tick } from 'svelte';

  export let profileData;
  export let friendId = null;
  export let state;
  export let bridge;

  const types = [
    { type: 0, label: '일반 게시물' },
    { type: 1, label: '프로필 사진' },
    { type: 2, label: '배경 사진' },
    { type: 3, label: '상태 메세지' },
    { type: 4, label: '디데이' },
    { type: 5, label: '음악' },
    { type: 6, label: '숏폼' },
    { type: 7, label: '카카오스토리' }
  ];
  const owner = bridge.postOwner(profileData, friendId);
  if (profileData?.posts && !Array.isArray(profileData.posts.contents)) profileData.posts.contents = [];
  const contents = Array.isArray(profileData?.posts?.contents) ? profileData.posts.contents : [];
  const cursor = () => (typeof profileData?.posts?.cursor === 'string' ? profileData.posts.cursor : '');
  let entries = readEntries();
  let pagination = profileData && state.friendPostPagination.get(profileData);
  if (!pagination && profileData && (entries.length || cursor())) {
    pagination = { pending: null, error: '', usedCursors: new Set(), focusMore: false };
    state.friendPostPagination.set(profileData, pagination);
  }
  let selectedType = state.friendPostFilters.get(owner.filterKey) ?? 'all';
  if (selectedType !== 'all' && !entries.some(({ post }) => post.type === selectedType)) {
    selectedType = 'all';
    state.friendPostFilters.delete(owner.filterKey);
  }
  let pending = Boolean(pagination?.pending);
  let pageError = pagination?.error || '';
  let section;
  let list;
  let more;
  let layoutCleanup = null;
  let active = true;
  let nextCursor = cursor();

  $: visible = entries.filter(({ post }) => selectedType === 'all' || post.type === selectedType);
  $: filters = [
    { type: 'all', label: '전체', count: entries.length },
    ...types
      .map(({ type, label }) => ({ type, label, count: entries.filter(({ post }) => post.type === type).length }))
      .filter(({ count }) => count > 0)
  ];

  function readEntries() {
    return contents.flatMap((post) => {
      const content = bridge.friendPostContent(post);
      return content && (content.imageUrl || content.text.trim()) ? [{ post, ...content }] : [];
    });
  }

  function postKey(post) {
    if (
      (typeof post?.postId === 'string' || Number.isSafeInteger(post?.postId)) &&
      /^[1-9]\d*$/.test(String(post.postId))
    )
      return `post:${String(post.postId)}`;
    if (typeof post?.shortFormId === 'string' && post.shortFormId) return `short:${post.shortFormId}`;
    return null;
  }

  function date(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > Date.now()) return null;
    const parsed = new Date(value);
    return {
      text: new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(parsed),
      iso: parsed.toISOString()
    };
  }

  async function arrange() {
    await tick();
    if (!active) return;
    layoutCleanup?.();
    layoutCleanup = bridge.arrangeMasonryCards(list);
  }

  function selectFilter(type) {
    if (selectedType === type) return;
    const scrollTop = bridge.detail.scrollTop;
    selectedType = type;
    state.friendPostFilters.set(owner.filterKey, type);
    void arrange().then(() => {
      if (active) bridge.detail.scrollTop = scrollTop;
    });
  }

  function isCurrent() {
    return active && section?.isConnected && bridge.isPostOwnerCurrent(owner);
  }

  async function watch(request) {
    await request;
    if (!isCurrent()) return;
    const scrollTop = bridge.detail.scrollTop;
    const oldPosts = new Set(entries.map(({ post }) => post));
    entries = readEntries();
    nextCursor = cursor();
    pending = Boolean(pagination.pending);
    pageError = pagination.error;
    await arrange();
    if (!active) return;
    bridge.detail.scrollTop = scrollTop;
    if (
      pagination.focusMore &&
      !bridge.shell.inert &&
      (document.activeElement === document.body || document.activeElement === more)
    ) {
      if (nextCursor) more?.focus({ preventScroll: true });
      else {
        const addedIndex = visible.findIndex(({ post }) => !oldPosts.has(post));
        (addedIndex >= 0
          ? list?.children[addedIndex]
          : section?.querySelector(`[data-post-filter="${selectedType}"]`)
        )?.focus({ preventScroll: true });
      }
    }
    pagination.focusMore = false;
  }

  function loadMore() {
    if (!isCurrent() || !cursor() || pagination.pending) return;
    pagination.error = '';
    pageError = '';
    pagination.focusMore = document.activeElement === more;
    const request = (async () => {
      const known = new Set(contents.map(postKey).filter(Boolean));
      while (cursor() && isCurrent() && bridge.isPostOwnerSelected(owner)) {
        const requestedCursor = cursor();
        const result = await bridge.api(`${owner.path}?cursor=${encodeURIComponent(requestedCursor)}`);
        if (!bridge.isPostOwnerCurrent(owner)) return;
        if (
          !Array.isArray(result.posts?.contents) ||
          (result.posts.cursor != null && typeof result.posts.cursor !== 'string')
        )
          throw new Error('게시물 목록 형식이 올바르지 않습니다.');
        for (const post of result.posts.contents) {
          const key = postKey(post);
          if (key && known.has(key)) continue;
          contents.push(post);
          if (key) known.add(key);
        }
        pagination.usedCursors.add(requestedCursor);
        const next = result.posts.cursor || '';
        profileData.posts.cursor = pagination.usedCursors.has(next) ? '' : next;
      }
    })()
      .catch((failure) => {
        if (bridge.isPostOwnerCurrent(owner)) pagination.error = failure.message || '게시물을 불러올 수 없습니다.';
      })
      .finally(() => {
        if (pagination.pending === request) pagination.pending = null;
      });
    pagination.pending = request;
    pending = true;
    void watch(request);
  }

  function openPost(event, post) {
    if (event.type === 'keydown') {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (event.repeat) return;
    }
    bridge.showFriendPostDetail(post, event.currentTarget, owner);
  }

  onMount(() => {
    void arrange();
    if (pagination?.pending) void watch(pagination.pending);
  });
  onDestroy(() => {
    active = false;
    layoutCleanup?.();
  });
</script>

{#if entries.length || nextCursor || pending}
  <section class="friend-detail-posts" bind:this={section} aria-busy={String(pending)}>
    <h3>게시물</h3>
    <div class="friend-post-filters" role="group" aria-label="게시물 유형 필터">
      {#each filters as filter}
        <button
          type="button"
          class="friend-post-filter"
          class:is-active={selectedType === filter.type}
          data-post-filter={filter.type}
          aria-pressed={String(selectedType === filter.type)}
          onclick={() => selectFilter(filter.type)}>{filter.label} {filter.count}</button
        >
      {/each}
    </div>
    <div class="friend-post-list" bind:this={list}>
      {#each visible as entry (entry.post)}
        {@const published = date(entry.post.createdAt)}
        {@const mediaCount =
          [0, 1, 2, 7].includes(entry.post.type) &&
          Number.isSafeInteger(entry.post.mediaCount) &&
          entry.post.mediaCount > 1
            ? entry.post.mediaCount
            : 0}
        <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
        <article
          class="friend-post-card is-clickable"
          data-post-type={entry.post.type}
          tabindex="0"
          role="button"
          aria-haspopup="dialog"
          aria-label={[
            entry.label,
            entry.post.pinned ? '고정' : '',
            mediaCount ? `첨부 ${mediaCount}개` : '',
            published?.text,
            '상세 보기'
          ]
            .filter(Boolean)
            .join(' · ')}
          onclick={(event) => openPost(event, entry.post)}
          onkeydown={(event) => openPost(event, entry.post)}
        >
          {#if entry.post.pinned || mediaCount}<div class="friend-post-badges">
              {#if entry.post.pinned}<span class="friend-post-badge">고정</span>{/if}{#if mediaCount}<span
                  class="friend-post-badge">첨부 {mediaCount}개</span
                >{/if}
            </div>{/if}
          <div class="friend-post-body" class:has-image={Boolean(entry.imageUrl)} class:is-text-only={!entry.imageUrl}>
            {#if entry.imageUrl}<div class="friend-post-media">
                <img
                  class="friend-post-image"
                  src={entry.imageUrl}
                  alt="게시물 미리보기"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  onerror={(event) => event.currentTarget.remove()}
                />
              </div>{/if}
            {#if entry.text.trim()}<p class="friend-post-text" title={entry.text}>{entry.text}</p>{/if}
          </div>
          {#if published}<div class="friend-post-footer">
              <time class="friend-post-date" datetime={published.iso}>{published.text}</time>
            </div>{/if}
        </article>
      {/each}
    </div>
    <button
      type="button"
      class="friend-post-load-more"
      bind:this={more}
      hidden={!nextCursor && !pending}
      disabled={pending}
      onclick={loadMore}>{pending ? '불러오는 중…' : '게시물 더 보기'}</button
    >
    <p class="friend-post-page-error" role="alert" hidden={!pageError}>{pageError}</p>
  </section>
{/if}
