<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Avatar from '../rooms/Avatar.svelte';
  import Loading from './Loading.svelte';

  export let snapshot;
  $: ({
    state,
    selectSelf,
    selectFriend,
    toggleGroup,
    loadMe,
    loadFriends,
    updatedFriendEntries,
    birthdayFriendEntries
  } = $snapshot);

  const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
  const statusPreview = (message) => {
    const characters = Array.from(segmenter.segment(message), ({ segment }) => segment);
    return characters.length > 21 ? `${characters.slice(0, 21).join('')}…` : message;
  };

  $: query = state.listQuery.trim().toLocaleLowerCase();
  $: friends = state.friends.filter((friend) => !friend.hidden);
  $: hiddenFriends = state.friends.filter((friend) => friend.hidden);
  $: friendsById = new Map(friends.map((friend) => [friend.id, friend]));
  $: matches = (friend) =>
    !query ||
    friend.name.toLocaleLowerCase().includes(query) ||
    friend.id.includes(query) ||
    (typeof friend.raw?.nickName === 'string' && friend.raw.nickName.toLocaleLowerCase().includes(query));
  $: visibleFriends = friends.filter(matches);
  $: visibleHiddenFriends = hiddenFriends.filter(matches);
  $: groups = [
    { label: '업데이트한 친구', entries: updatedFriendEntries(friendsById), key: 'updatedFriendsExpanded' },
    { label: '생일인 친구', entries: birthdayFriendEntries(friendsById), key: 'birthdayFriendsExpanded' },
    { label: '즐겨찾는 친구', entries: friends.filter((friend) => friend.favorite), key: 'favoritesExpanded' },
    { label: '친구', entries: friends, key: 'friendsExpanded' },
    { label: '숨김 친구', entries: hiddenFriends, key: 'hiddenFriendsExpanded' }
  ];
</script>

{#snippet loading(message)}
  <li class="channel-loading">
    <Loading {message} />
  </li>
{/snippet}

{#snippet row(friend)}
  <li>
    <button
      type="button"
      class:is-selected={friend.key === state.selectedFriendKey}
      class="channel-item friend-item"
      aria-current={friend.key === state.selectedFriendKey ? 'true' : 'false'}
      aria-label={!friend.name ? `친구 ID ${friend.id}` : undefined}
      onclick={() => selectFriend(friend.key)}
    >
      <Avatar url={friend.profileImageUrl} small />
      <span class="channel-text">
        <span class="channel-name">{friend.name}</span>
        <span class="friend-status">{friend.birthdayLabel || statusPreview(friend.statusMessage) || '\u3000'}</span>
      </span>
    </button>
  </li>
{/snippet}

<li class="section-caption self-caption">나</li>
{#if state.meLoading && !state.meLoaded}
  {@render loading('내 프로필을 불러오는 중…')}
{:else if state.meError && !state.meLoaded}
  <li class="error-message">{state.meError}<button type="button" onclick={loadMe}>다시 시도</button></li>
{:else if state.me}
  <li class="self-profile-frame">
    <button
      type="button"
      class="self-profile-card"
      class:is-selected={state.selectedSelf}
      aria-current={state.selectedSelf ? 'true' : 'false'}
      onclick={selectSelf}
    >
      <Avatar url={state.me.profileImageUrl} small />
      <div class="self-profile-info">
        <strong class="self-profile-name">{state.me.name}</strong>
        <p class="self-profile-status">{state.me.statusMessage || '\u3000'}</p>
      </div>
    </button>
  </li>
{:else}
  <li class="error-message">
    내 프로필을 불러올 수 없습니다. 연결 후 다시 시도해 주세요.<button type="button" onclick={loadMe}>다시 시도</button>
  </li>
{/if}

{#if state.friendsError && !state.friendsLoaded}
  <li class="error-message">{state.friendsError}<button type="button" onclick={loadFriends}>다시 시도</button></li>
{:else if state.friendsLoading && !state.friendsLoaded}
  {@render loading('친구를 불러오는 중…')}
{:else if query}
  {#each [{ label: '친구', entries: visibleFriends }, { label: '숨김 친구', entries: visibleHiddenFriends }] as group}
    {#if group.entries.length}
      <li class="list-divider">
        <span class="friend-group-label"
          ><span>{group.label}</span><span class="friend-group-count">{group.entries.length}</span></span
        >
      </li>
      {#each group.entries as friend (friend.key)}{@render row(friend)}{/each}
    {/if}
  {/each}
  {#if !visibleFriends.length && !visibleHiddenFriends.length}<li class="channel-empty">검색 결과가 없습니다.</li>{/if}
{:else}
  {#each groups as group}
    {#if group.entries.length}
      <li class="list-divider">
        <button
          type="button"
          class="friend-group-toggle"
          data-friend-group={group.key}
          aria-expanded={String(state[group.key])}
          onclick={() => toggleGroup(group.key)}
        >
          <span class="friend-group-label"
            ><span>{group.label}</span><span class="friend-group-count">{group.entries.length}</span></span
          ><span class="friend-group-chevron"></span>
        </button>
      </li>
      {#if state[group.key]}{#each group.entries as friend (friend.key)}{@render row(friend)}{/each}{/if}
    {/if}
  {/each}
{/if}
