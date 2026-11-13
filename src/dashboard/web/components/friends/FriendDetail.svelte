<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Icon from '../Icon.svelte';
  import Loading from './Loading.svelte';
  import DetailField from './DetailField.svelte';
  import FriendMusic from './FriendMusic.svelte';
  import FriendPosts from './FriendPosts.svelte';
  import SelfOpenLinks from './SelfOpenLinks.svelte';
  import FriendAvatar from './FriendAvatar.svelte';
  import FriendBackground from './FriendBackground.svelte';
  import UserPermissions from '../UserPermissions.svelte';

  export let snapshot;
  $: ({ state, friend, self, bridge } = $snapshot);
  let hasBackground = false;

  $: isSelf = friend === null;
  $: person = isSelf ? self : friend;
  $: profileData = isSelf ? state.selfProfile?.profile : state.friendProfiles.get(friend.id);
  $: main = state.selfProfile?.main;
  $: nickname = isSelf
    ? typeof profileData?.nickname === 'string'
      ? profileData.nickname
      : main?.nickname || ''
    : typeof profileData?.nickname === 'string'
      ? profileData.nickname
      : '';
  $: certified = profileData?.hasMeBadge === true;
  $: showNickname = nickname.trim() && nickname.trim() !== person.name.trim();
  $: status = isSelf ? person.statusMessage : profileData?.statusMessage?.message || '';
  $: memo = !isSelf ? state.friendMemos.get(friend.id) || '' : '';
  $: memoLoading = !isSelf && state.friendMemosLoading.has(friend.id);
  $: memoError = !isSelf && state.friendMemoErrors.get(friend.id);
  $: showMemo = !isSelf && (memoLoading || memoError || state.friendMemos.has(friend.id));
  $: userId = isSelf ? bridge.normalizeId(profileData?.userId) : bridge.normalizeId(friend.raw?.userId);
  $: addedAt = !isSelf ? friendAddedAt(state.friendCreatedAt[friend.id]) : null;

  function friendAddedAt(seconds) {
    const date = new Date(Number(seconds) * 1000);
    if (!seconds || Number.isNaN(date.getTime())) return null;
    return {
      iso: date.toISOString(),
      text: new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        timeZone: 'Asia/Seoul'
      }).format(date)
    };
  }
</script>

<div class="friend-detail-content">
  <div class="self-profile-frame friend-detail-frame" class:has-background={hasBackground}>
    <FriendBackground {profileData} {bridge} bind:available={hasBackground} />
    {#if !isSelf}
      <span
        class="friend-favorite"
        class:is-favorite={friend.favorite}
        role="img"
        aria-label={friend.favorite ? '즐겨찾는 친구' : '즐겨찾는 친구가 아님'}
        title={friend.favorite ? '즐겨찾는 친구' : '즐겨찾는 친구가 아님'}
      >
        <Icon name={friend.favorite ? 'favorite' : 'favorite-outline'} />
      </span>
    {/if}
    <div class="friend-detail-summary">
      <div class="friend-detail-card">
        <FriendAvatar {profileData} source={isSelf ? main : friend} {isSelf} {bridge} />
        <div class="friend-detail-info">
          <div class="friend-detail-title-row">
            <h3 class="friend-detail-name" class:has-certification={certified && !showNickname}>
              {#if certified && !showNickname}<span class="friend-detail-name-text">{person.name}</span><img
                  class="friend-detail-certified"
                  src="/icons/profile-certified.svg"
                  alt="프로필 인증 배지"
                  title="프로필 인증 배지"
                />{:else}{person.name}{/if}
            </h3>
            {#if !isSelf && friend.hidden}<span class="friend-hidden-badge">숨김 친구</span>{/if}
          </div>
          {#if showNickname}
            <p class="friend-detail-nickname" class:has-certification={certified}>
              {#if certified}<span class="friend-detail-name-text">{nickname}</span><img
                  class="friend-detail-certified"
                  src="/icons/profile-certified.svg"
                  alt="프로필 인증 배지"
                  title="프로필 인증 배지"
                />{:else}{nickname}{/if}
            </p>
          {/if}
        </div>
      </div>
      {#if status.trim()}<p class="friend-detail-status">{status}</p>{/if}
      {#if !isSelf && profileData?.suspended === true}
        <div class="friend-detail-notice">
          <Icon name="info" />
          <p>카카오톡 이용이 일시적으로 제한된 유저입니다.</p>
        </div>
      {/if}
      {#if !isSelf && friend.memorial}
        <div class="friend-detail-notice">
          <Icon name="info" />
          <p>추모 프로필입니다.</p>
        </div>
      {/if}
    </div>
  </div>

  {#if showMemo}
    <section class="friend-detail-memo">
      <h3>메모</h3>
      <div class="friend-memo-content">
        {#if memoLoading}
          <Loading message="친구 메모를 불러오는 중…" />
        {:else if memoError}
          <p class="friend-memo-error">{memoError}</p>
          <button type="button" class="button-secondary" onclick={() => bridge.loadFriendMemo(friend, true)}
            >다시 시도</button
          >
        {:else}
          <p class="friend-memo-text" class:is-empty={!memo}>{memo || '저장된 메모가 없습니다.'}</p>
        {/if}
      </div>
    </section>
  {/if}

  <UserPermissions {person} {state} hasRole={bridge.hasRole} onChange={bridge.changeRole} onRetry={bridge.loadRoles} />

  {#if !isSelf && state.friendProfilesLoading.has(friend.id)}
    <Loading message="프로필 정보를 불러오는 중…" />
  {:else if !isSelf && state.friendProfileErrors.has(friend.id)}
    <div class="friend-detail-extra-state">
      <p>{state.friendProfileErrors.get(friend.id)}</p>
      <button type="button" class="button-secondary" onclick={() => bridge.loadFriendProfile(friend, true)}
        >다시 시도</button
      >
    </div>
  {/if}

  <div class="friend-detail-overview">
    <section class="friend-detail-basics">
      <h3>유저 정보</h3>
      <div class="friend-detail-fields">
        <DetailField
          label="유저 ID"
          value={userId || '정보 없음'}
          icon="id-card"
          copyValue={userId}
          showToast={bridge.showToast}
        />
        {#if !isSelf && friend.phoneNumber.trim()}
          <DetailField
            label="전화번호"
            value={friend.phoneNumber.trim()}
            icon="phone"
            copyValue={friend.phoneNumber.trim()}
            showToast={bridge.showToast}
          />
        {/if}
        {#if !isSelf}
          <DetailField
            label="친구 추가 일시"
            value={addedAt?.text || '정보 없음'}
            datetime={addedAt?.iso || ''}
            icon="calendar"
          />
        {/if}
      </div>
    </section>
    <FriendMusic {profileData} />
  </div>

  {#if isSelf}
    <SelfOpenLinks
      entries={state.selfProfile.openProfiles}
      title="나의 오픈프로필"
      fallbackName="이름 없는 오픈프로필"
      imageKey="profileImageUrl"
      linkKind="오픈프로필"
      {bridge}
    />
    <SelfOpenLinks
      entries={state.selfProfile.directOpenChats}
      title="나의 1:1 오픈채팅방"
      fallbackName="이름 없는 오픈채팅방"
      imageKey="imageUrl"
      linkKind="오픈채팅방"
      {bridge}
    />
    <SelfOpenLinks
      entries={state.selfProfile.groupOpenChats}
      title="나의 그룹 오픈채팅방"
      fallbackName="이름 없는 오픈채팅방"
      imageKey="imageUrl"
      linkKind="오픈채팅방"
      {bridge}
    />
    <SelfOpenLinks
      entries={state.selfProfile.communityOpenChats}
      title="나의 커뮤니티 오픈채팅방"
      fallbackName="이름 없는 커뮤니티"
      imageKey="imageUrl"
      linkKind="커뮤니티 오픈채팅방"
      {bridge}
    />
  {/if}
  {#key profileData}
    <FriendPosts {state} {profileData} friendId={isSelf ? null : friend.id} {bridge} />
  {/key}
</div>
