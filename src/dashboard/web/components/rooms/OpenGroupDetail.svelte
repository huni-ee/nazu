<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Avatar from './Avatar.svelte';
  import Icon from '../Icon.svelte';
  import { safeImageUrl } from '../../utils/profile.js';

  export let group;
  export let rooms;
  export let actions;
  export let onCopy;

  $: isProfile = group.groupKind === 'profile';
  $: kind = isProfile ? '내 오픈프로필' : '내 1:1 오픈채팅';
  $: name =
    typeof group.name === 'string' && group.name.trim()
      ? group.name
      : isProfile
        ? '이름 없는 오픈프로필'
        : '이름 없는 1:1 오픈채팅';
  $: description = typeof group.description === 'string' ? group.description.trim() : '';
  $: link = safeImageUrl(group.url);
</script>

<div class="open-profile-detail">
  <button
    type="button"
    class="icon-button room-list-back open-profile-back"
    aria-label="오픈채팅방 목록으로 돌아가기"
    onclick={actions.goBack}><Icon name="chevron-left" /></button
  >
  <div class="open-profile-layout">
    <section class="open-profile-card" aria-labelledby="open-profile-title">
      <div class="open-profile-summary">
        <Avatar url={group.profileImageUrl} />
        <div class="open-profile-identity">
          <p class="open-profile-kind">{kind}</p>
          <h2 id="open-profile-title">{name}</h2>
        </div>
      </div>
      {#if description}<p class="open-profile-description">{description}</p>{/if}
      {#if link}
        <div class="open-profile-link-row">
          <a class="open-profile-link" href={link} target="_blank" rel="noopener noreferrer" title={link}>
            <span class="open-profile-link-label">{isProfile ? '오픈프로필 링크' : '오픈채팅 링크'}</span>
            <span class="open-profile-link-url">{link}</span>
          </a>
          <button
            type="button"
            class="icon-button open-profile-copy"
            aria-label="링크 복사"
            title="링크 복사"
            onclick={(event) =>
              onCopy(
                event,
                group.url.trim(),
                isProfile ? '오픈프로필 링크를 복사했습니다.' : '오픈채팅 링크를 복사했습니다.'
              )}
            ><span class="copy-feedback-icons" aria-hidden="true">
              <Icon name="copy" className="copy-feedback-copy" />
              <Icon name="check" className="copy-feedback-check" />
            </span></button
          >
        </div>
      {/if}
    </section>

    <section class="open-profile-rooms" aria-labelledby="open-profile-rooms-title">
      <div class="open-profile-rooms-heading">
        <h3 id="open-profile-rooms-title">1:1 채팅방</h3>
        <span class="open-profile-room-count" aria-label={`${rooms.length}개`}>{rooms.length}</span>
      </div>
      {#if rooms.length}
        <ul class="open-profile-room-list">
          {#each rooms as room (room.id)}
            <li>
              <button type="button" class="open-profile-room" onclick={() => actions.selectChannel(room.id, true)}>
                <Avatar url={room.profileImageUrl} />
                <span class="open-profile-room-name">{room.name}</span>
                <span class="open-profile-room-arrow" aria-hidden="true"><Icon name="chevron-right" /></span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="open-profile-empty">
          <Icon name="openchat" />
          <p>대화 중인 오픈채팅방이 없습니다.</p>
        </div>
      {/if}
    </section>
  </div>
</div>
