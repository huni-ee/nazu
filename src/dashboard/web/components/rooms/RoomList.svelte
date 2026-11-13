<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Avatar from './Avatar.svelte';
  import { channelAvatarFallback } from '../../constants/chat.js';
  export let snapshot;
  $: view = $snapshot;
  $: state = view.state;
  $: actions = view.actions;
  $: helpers = view.helpers;
  $: channels = helpers.visibleChannels();
  $: groups = state.tab === 'openchat' ? helpers.visibleOpenGroups() : [];
</script>

{#if state.tab === 'roles'}
  {#each ['admin', 'ban'] as kind}
    <li>
      <button
        type="button"
        class="channel-item"
        class:is-selected={kind === state.roleView}
        aria-current={kind === state.roleView ? 'true' : 'false'}
        onclick={() => actions.selectRoleView(kind)}
      >
        <Avatar fallback={kind === 'admin' ? 'users' : 'user'} />
        <span class="channel-text"
          ><span class="channel-line"
            ><span class="channel-name">{kind === 'admin' ? '관리자' : '밴 유저'}</span><span class="channel-count"
              >{state.roles[kind].size}</span
            ></span
          ><span class="channel-description">모든 채팅방에 적용</span></span
        >
      </button>
    </li>
  {/each}
{:else if !channels.length && !groups.length}
  <li class="channel-empty">
    {state.listQuery
      ? '검색 결과가 없습니다.'
      : state.tab === 'openchat'
        ? '오픈채팅방이 없습니다.'
        : '참여 중인 채팅방이 없습니다.'}
  </li>
{:else}
  {#each groups as entry (helpers.openGroupKey(entry))}
    {@const key = helpers.openGroupKey(entry)}
    {@const selected = key === state.selectedOpenGroupKey}
    <li>
      <button
        type="button"
        class="channel-item room-channel-item open-group-item"
        class:is-selected={selected}
        aria-current={selected ? 'true' : 'false'}
        data-open-group-key={key}
        onclick={() => actions.selectOpenGroup(key)}
      >
        <Avatar url={entry.profileImageUrl} />
        <span class="channel-text"
          ><span class="channel-line"
            ><span class="channel-name"
              >{entry.name || (entry.groupKind === 'profile' ? '이름 없는 오픈프로필' : '이름 없는 1:1 오픈채팅')}</span
            ></span
          ><span class="channel-description">{entry.groupKind === 'profile' ? '내 오픈프로필' : '내 1:1 오픈채팅'}</span
          ></span
        >
        <span class="open-group-count" aria-label={`${helpers.ownGroupRooms(entry).length}개 채팅방`}
          >{helpers.ownGroupRooms(entry).length}</span
        >
      </button>
    </li>
  {/each}
  {#each channels as channel (channel.id)}
    {@const selected = channel.id === state.selectedChannelId}
    {@const count = channel.memberCount ?? state.members.get(channel.id)?.length}
    {@const type = channel.type.trim()}
    <li>
      <button
        type="button"
        class="channel-item room-channel-item"
        class:is-selected={selected}
        aria-current={selected ? 'true' : 'false'}
        onclick={() => actions.selectChannel(channel.id)}
      >
        <Avatar url={channel.profileImageUrl} fallback={channelAvatarFallback(type)} />
        <span class="channel-text"
          ><span class="channel-line"
            ><span class="channel-name">{channel.name}</span>{#if count !== undefined && count !== null}<span
                class="channel-count"
                aria-label={`멤버 ${count}명`}>{count}</span
              >{/if}</span
          ><span class="channel-description"
            >{helpers.channelTypeLabels.get(type) ??
              helpers.channelTypeLabels.get(type.toUpperCase()) ??
              (type || '유형 미확인')}</span
          ></span
        >
      </button>
    </li>
  {/each}
{/if}
