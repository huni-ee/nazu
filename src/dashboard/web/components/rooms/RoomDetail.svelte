<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { tick } from 'svelte';
  import Avatar from './Avatar.svelte';
  import { channelAvatarFallback } from '../../constants/chat.js';
  import Icon from '../Icon.svelte';
  import { copyText } from '../../utils/copy-field.js';
  import { safeImageUrl } from '../../utils/profile.js';
  import RoleButton from './RoleButton.svelte';
  import OpenGroupDetail from './OpenGroupDetail.svelte';
  import DetailField from '../friends/DetailField.svelte';
  import CopyIcon from '../friends/CopyIcon.svelte';
  import UserPermissions from '../UserPermissions.svelte';

  export let snapshot;
  let memberSearchOpen = false;
  let searchChannelId;
  let searchInput;
  let searchToggle;
  $: view = $snapshot;
  $: state = view.state;
  $: actions = view.actions;
  $: helpers = view.helpers;
  $: channel = helpers.currentChannel();
  $: if (channel?.id !== searchChannelId) {
    searchChannelId = channel?.id;
    memberSearchOpen = false;
  }
  $: group = helpers.selectedOpenGroup();
  $: members = channel ? state.members.get(channel.id) : null;
  $: selected = members?.find((member) => member.id === state.selectedMemberId);
  $: query = state.memberQuery.trim().toLocaleLowerCase();
  $: filtered = (members ?? []).filter(
    (member) => !query || member.name.toLocaleLowerCase().includes(query) || member.id.includes(query)
  );
  $: type = channel
    ? (helpers.channelTypeLabels.get(channel.type) ??
      helpers.channelTypeLabels.get(channel.type.toUpperCase()) ??
      channel.type)
    : '';
  $: count = channel ? (channel.memberCount ?? members?.length) : null;
  $: hosts = members?.filter((member) => member.host).map((member) => member.name) ?? [];
  $: moderators = members?.filter((member) => member.moderator).map((member) => member.name) ?? [];
  $: groupRooms = group ? helpers.ownGroupRooms(group) : [];
  $: roleKind = state.roleView;
  $: roleEntries = [...(state.roles[roleKind]?.values() ?? [])].filter(
    (entry) => !query || entry.id.includes(query) || helpers.roleDisplayName(entry).toLocaleLowerCase().includes(query)
  );

  async function copy(event, text, message) {
    try {
      await copyText(event.currentTarget, text);
      actions.showToast(message);
    } catch {
      actions.showToast('복사하지 못했습니다. 값을 선택해 복사해 주세요.', true);
    }
  }

  function updateQuery(event) {
    actions.setMemberQuery(event.currentTarget.value);
  }

  async function toggleMemberSearch() {
    memberSearchOpen = !memberSearchOpen;
    if (!memberSearchOpen && state.memberQuery) actions.setMemberQuery('');
    await tick();
    if (memberSearchOpen) searchInput?.focus();
    else searchToggle?.focus();
  }
</script>

{#snippet search(placeholder)}
  <label class="search-field member-search"
    ><Icon name="search" /><input
      bind:this={searchInput}
      type="search"
      autocomplete="off"
      {placeholder}
      aria-label={placeholder}
      value={state.memberQuery}
      oninput={updateQuery}
    /></label
  >
{/snippet}

{#if state.tab === 'roles'}
  {@const label = roleKind === 'admin' ? '관리자' : '밴 유저'}
  <div class="roles-detail-content">
    <div class="detail-intro">
      <div>
        <h3>{label}</h3>
        <p>
          {roleKind === 'admin' ? '봇 관리자 명령을 사용할 수 있는 유저입니다.' : '봇 명령 사용이 제한된 유저입니다.'}
        </p>
      </div>
    </div>
    {@render search('이름 또는 ID 검색')}
    <div class="section-caption" id="role-caption"><span>{label}</span><span>{roleEntries.length}</span></div>
    <ul class="role-list" id="role-list">
      {#each roleEntries as entry (entry.id)}
        {@const member = { id: entry.id, name: helpers.roleDisplayName(entry) }}
        <li class="member-row">
          <Avatar small />
          <div class="member-info">
            <span class="member-name">{member.name}</span><span class="member-id">ID {member.id}</span>
          </div>
          <div class="member-actions">
            <button
              type="button"
              class="role-button {roleKind} is-on role-removal"
              aria-label={`${member.name} ${roleKind === 'admin' ? '관리자' : '밴'} 해제`}
              disabled={state.pending.has(`${roleKind}:${member.id}`)}
              onclick={() => actions.changeRole(member, roleKind, false)}>해제</button
            >
          </div>
        </li>
      {:else}
        <li class="inline-empty">
          {query
            ? '검색 결과가 없습니다.'
            : roleKind === 'admin'
              ? '지정된 관리자가 없습니다.'
              : '밴된 유저가 없습니다.'}
        </li>
      {/each}
    </ul>
  </div>
{:else if channel && selected}
  <div class="room-member-detail is-friend-detail">
    <button type="button" class="button-secondary room-member-back" onclick={() => actions.selectMember(null)}
      >멤버 목록</button
    >
    <div class="friend-detail-content">
      <div class="friend-detail-frame">
        <div class="friend-detail-summary">
          <div class="friend-detail-card">
            <Avatar url={selected.profileImageUrl} className="friend-detail-avatar" />
            <div class="friend-detail-info">
              <div class="friend-detail-title-row">
                <h3 class="friend-detail-name">{selected.name}</h3>
                {#if selected.host || selected.moderator || selected.isBot}
                  <span class="member-role">{selected.host ? '방장' : selected.moderator ? '부방장' : '봇'}</span>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
      <UserPermissions
        person={selected}
        {state}
        hasRole={helpers.hasRole}
        onChange={actions.changeRole}
        onRetry={actions.loadRoles}
      />
      <section class="friend-detail-basics">
        <h3>유저 정보</h3>
        <div class="friend-detail-fields">
          <DetailField
            label="유저 ID"
            value={selected.id}
            icon="id-card"
            copyValue={selected.id}
            showToast={actions.showToast}
          />
        </div>
      </section>
    </div>
  </div>
{:else if channel}
  <div class="room-detail-content">
    <section class="room-info" aria-labelledby="room-info-title">
      <div class="room-info-heading-row">
        <div class="room-info-heading-main">
          <button
            type="button"
            class="icon-button room-list-back"
            aria-label="채팅방 목록으로 돌아가기"
            onclick={actions.goBack}><Icon name="chevron-left" /></button
          >
          <h3 class="room-info-heading" id="room-info-title">채팅방 정보</h3>
        </div>
        <button
          type="button"
          class="button-secondary room-info-enter"
          disabled={state.pending.has(`enter:${channel.id}`)}
          onclick={() => actions.enterRoom(channel)}
          ><Icon name="channel-enter" /><span
            >{state.pending.has(`enter:${channel.id}`) ? '열기 요청 중…' : '카카오톡에서 열기'}</span
          ></button
        >
      </div>
      <div class="room-info-summary">
        <Avatar url={channel.profileImageUrl} fallback={channelAvatarFallback(channel.type)} />
        <h4>{channel.name}</h4>
      </div>
      <dl class="room-info-fields">
        <div class="room-info-field">
          <dt>채팅방 ID</dt>
          <dd class="room-info-copy-value">
            <span>{channel.id}</span>
            <button
              type="button"
              class="icon-button room-info-copy"
              aria-label="채팅방 ID 복사"
              title="채팅방 ID 복사"
              onclick={(event) => copy(event, channel.id, '채팅방 ID를 복사했습니다.')}><CopyIcon /></button
            >
          </dd>
        </div>
        {#if type}<div class="room-info-field">
            <dt>채팅방 종류</dt>
            <dd>{type}</dd>
          </div>{/if}{#if count !== undefined && count !== null}<div class="room-info-field">
            <dt>멤버 수</dt>
            <dd>{count}명</dd>
          </div>{/if}{#if hosts.length}<div class="room-info-field">
            <dt>방장</dt>
            <dd>{hosts.join(', ')}</dd>
          </div>{/if}{#if moderators.length}<div class="room-info-field">
            <dt>부방장</dt>
            <dd>{moderators.join(', ')}</dd>
          </div>{/if}{#if typeof channel.openChannel?.description === 'string' && channel.openChannel.description.trim()}<div
            class="room-info-field"
          >
            <dt>소개</dt>
            <dd>{channel.openChannel.description}</dd>
          </div>{/if}{#if safeImageUrl(channel.openChannel?.url)}<div class="room-info-field">
            <dt>오픈채팅 링크</dt>
            <dd class="room-info-copy-value">
              <a
                class="room-info-link"
                href={safeImageUrl(channel.openChannel.url)}
                target="_blank"
                rel="noopener noreferrer">{safeImageUrl(channel.openChannel.url)}</a
              >
              <button
                type="button"
                class="icon-button room-info-copy"
                aria-label="오픈채팅 링크 복사"
                title="오픈채팅 링크 복사"
                onclick={(event) => copy(event, safeImageUrl(channel.openChannel.url), '오픈채팅 링크를 복사했습니다.')}
                ><CopyIcon /></button
              >
            </dd>
          </div>{/if}
      </dl>
    </section>
    <div class="detail-intro room-members-heading">
      <h3>멤버</h3>
      <div class="header-actions room-members-actions">
        <button
          type="button"
          class="icon-button room-members-search-toggle"
          bind:this={searchToggle}
          aria-label="멤버 검색"
          title={memberSearchOpen ? '검색 닫기' : '멤버 검색'}
          aria-expanded={memberSearchOpen}
          aria-controls="room-member-search"
          disabled={!members}
          onclick={toggleMemberSearch}><Icon name="search" /></button
        >
        <button
          type="button"
          class="icon-button room-members-refresh"
          aria-label="멤버 새로고침"
          title="멤버 새로고침"
          aria-busy={state.membersLoading.has(channel.id)}
          disabled={state.membersLoading.has(channel.id)}
          onclick={() => actions.loadMembers(channel.id, true)}><Icon name="refresh" /></button
        >
      </div>
    </div>
    {#if !members && state.membersLoading.has(channel.id)}<p>멤버 목록을 불러오는 중…</p>
    {:else if !members && state.memberErrors.has(channel.id)}<div class="room-members-error">
        <p>멤버 목록을 불러올 수 없습니다.</p>
        <button
          type="button"
          class="button-secondary room-member-back"
          onclick={() => actions.loadMembers(channel.id, true)}>다시 시도</button
        >
      </div>
    {:else}
      <div id="room-member-search" hidden={!memberSearchOpen}>
        {@render search('멤버 이름 또는 ID 검색')}
      </div>
      <div class="section-caption"><span>멤버</span><span>{members?.length ?? 0}</span></div>
      <ul class="member-list">
        {#each filtered as member (member.id)}
          <li class="member-row">
            <button
              type="button"
              class="member-profile-button"
              aria-label={`${member.name} 프로필 보기`}
              onclick={() => actions.selectMember(member.id)}
              ><Avatar url={member.profileImageUrl} small />
              <div class="member-info">
                <span class="member-name"
                  ><span class="member-label">{member.name}</span
                  >{#if member.host || member.moderator || member.isBot}<span class="member-role"
                      >{member.host ? '방장' : member.moderator ? '부방장' : '봇'}</span
                    >{/if}</span
                ><span class="member-id">ID {member.id}</span>
              </div></button
            >
            <div class="member-actions">
              <RoleButton {member} kind="admin" {state} {actions} {helpers} /><RoleButton
                {member}
                kind="ban"
                {state}
                {actions}
                {helpers}
              />
            </div>
          </li>
        {:else}<li class="inline-empty">{query ? '검색 결과가 없습니다.' : '멤버가 없습니다.'}</li>{/each}
      </ul>
    {/if}
  </div>
{:else if group}
  <OpenGroupDetail {group} rooms={groupRooms} {actions} onCopy={copy} />
{/if}
