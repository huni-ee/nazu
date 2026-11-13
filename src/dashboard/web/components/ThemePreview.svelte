<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { navBarConfig } from '../config';
  import Icon from './Icon.svelte';
</script>

{#snippet navigation()}
  {#each navBarConfig.links as item (item.id)}
    <span class="theme-preview-nav" class:is-active={item.id === 'nav-friends'}><Icon name={item.icon} /></span>
  {/each}
  <span class="theme-preview-nav-profile"><span class="theme-preview-avatar"><Icon name="user" /></span></span>
  {#each navBarConfig.actions as item (item.id)}
    <span class="theme-preview-nav"><Icon name={item.icon} /></span>
  {/each}
{/snippet}

{#snippet friendList()}
  <div class="theme-preview-list-header">
    <strong>친구</strong>
    <span><Icon name="search" /><Icon name="refresh" /></span>
  </div>
  <div class="theme-preview-list-body">
    <div class="theme-preview-group">나</div>
    <div class="theme-preview-friend">
      <span class="theme-preview-avatar"><Icon name="user" /></span><span>내 프로필</span>
    </div>
    <div class="theme-preview-group"><span>생일인 친구 <span>1</span></span><Icon name="chevron-down" /></div>
    <div class="theme-preview-friend">
      <span class="theme-preview-avatar"><Icon name="user" /></span><span>친구</span>
    </div>
    <div class="theme-preview-group"><span>즐겨찾는 친구 <span>1</span></span><Icon name="chevron-down" /></div>
    <div class="theme-preview-friend">
      <span class="theme-preview-avatar"><Icon name="user" /></span><span>친구</span>
    </div>
  </div>
{/snippet}

<figure class="theme-preview">
  <div class="theme-preview-window" aria-hidden="true">
    <div class="theme-preview-desktop">
      <div class="theme-preview-rail">{@render navigation()}</div>
      <div class="theme-preview-list">{@render friendList()}</div>
      <div class="theme-preview-detail">
        <Icon name="users" />
        <strong>친구를 선택하세요</strong>
        <span>왼쪽 목록에서 친구를 선택해 프로필 정보를 확인하세요.</span>
      </div>
    </div>
    <div class="theme-preview-mobile">
      <div class="theme-preview-list">{@render friendList()}</div>
      <div class="theme-preview-mobile-nav">{@render navigation()}</div>
    </div>
  </div>
  <figcaption>미리보기</figcaption>
</figure>
