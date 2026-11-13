<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { onMount } from 'svelte';
  import { navBarConfig } from './config';
  import icons from 'virtual:dashboard-icons';
  import Icon from './components/Icon.svelte';

  // 기존 컨트롤러는 Svelte가 DOM을 그린 뒤에 붙인다.
  onMount(() => {
    void import('./dashboard/index.js');
  });
</script>

<div class="app-shell is-home" id="app-shell">
  <main class="main-layout">
    <nav class="sidebar" aria-label="대시보드 메뉴">
      <div class="sidebar-items">
        {#each navBarConfig.links as item (item.id)}
          <button
            class:is-active={item.active}
            class="sidebar-item"
            id={item.id}
            type="button"
            aria-label={item.name}
            aria-current={item.active ? 'page' : undefined}
            title={item.name}
          >
            <Icon name={item.icon} />
          </button>
        {/each}
      </div>
      <div class="sidebar-items">
        <div class="profile-switcher" id="profile-switcher"></div>
        {#each navBarConfig.actions as item (item.id)}
          <button
            class:is-active={item.active}
            class="sidebar-item"
            id={item.id}
            type="button"
            aria-label={item.name}
            aria-current={item.active ? 'page' : undefined}
            title={item.name}
          >
            <Icon name={item.icon} />
          </button>
        {/each}
      </div>
    </nav>

    <aside class="channel-pane" aria-label="목록">
      <div class="channel-pane-tools" id="channel-pane-tools">
        <header class="channel-pane-header">
          <h1 id="list-title">홈</h1>
          <div class="header-actions" id="list-header-actions" role="group" aria-label="목록">
            <button
              class="icon-button"
              id="list-search-toggle"
              type="button"
              aria-label="친구 검색"
              aria-expanded="false"
              aria-controls="list-search-wrap"
              title="친구 검색"><Icon name="search" /></button
            >
            <button class="icon-button" id="list-refresh" type="button" aria-label="목록 새로고침" title="목록 새로고침"
              ><Icon name="refresh" /></button
            >
          </div>
        </header>
        <div class="search-wrap" id="list-search-wrap" hidden>
          <label class="search-field"
            ><Icon name="search" /><input
              id="list-search"
              type="search"
              autocomplete="off"
              placeholder="친구 검색"
              aria-label="친구 검색"
            /></label
          >
        </div>
      </div>
      <div class="channel-scroll" id="channel-scroll"><ul class="channel-list" id="channel-list"></ul></div>
    </aside>

    <section class="detail-pane" aria-label="상세 정보">
      <header class="detail-header" id="detail-header" hidden>
        <button class="back-button" id="back-button" type="button" aria-label="목록으로 돌아가기">
          <Icon name="chevron-left" />
        </button>
        <div class="detail-header-main">
          <div class="profile profile-header" id="header-profile">
            <span class="profile-fallback"><Icon name="users" /></span>
          </div>
          <div class="detail-heading">
            <!-- svelte-ignore a11y_missing_content: the controller sets the selected view title. -->
            <h2 id="detail-title"></h2>
            <p id="detail-subtitle"></p>
          </div>
        </div>
        <div class="header-actions" id="member-header-actions" role="group" aria-label="멤버">
          <button
            class="icon-button"
            id="member-search-toggle"
            type="button"
            aria-label="멤버 검색"
            title="멤버 검색"
            hidden><Icon name="search" /></button
          >
          <button
            class="icon-button"
            id="member-refresh"
            type="button"
            aria-label="멤버 새로고침"
            title="멤버 새로고침"
            hidden><Icon name="refresh" /></button
          >
        </div>
      </header>
      <div class="detail-scroll" id="detail-scroll">
        <div class="home-content">
          <header class="home-intro">
            <div class="home-intro-copy">
              <h1 class="home-title">Arisa Dashboard</h1>
              <p class="home-description">연결된 계정의 정보를 확인하고 도구를 사용하세요.</p>
            </div>
            <section class="home-connection" data-state="checking" aria-label="Arisa 연결 확인" aria-busy="false">
              <div class="home-connection-header">
                <span class="home-connection-dot" aria-hidden="true"></span>
                <span class="home-connection-label" role="status" aria-live="polite">연결 확인 대기</span>
                <button
                  class="icon-button home-connection-refresh"
                  type="button"
                  aria-label="연결 다시 확인"
                  title="연결 다시 확인"
                  disabled><Icon name="refresh" /></button
                >
              </div>
              <p class="home-connection-meta">계정 연결 정보를 불러오고 있습니다.</p>
            </section>
          </header>
        </div>
      </div>
    </section>
  </main>
</div>
{#each Object.entries(icons) as [name, markup] (name)}
  <template id={`dashboard-icon-${name}`}>{@html markup}</template>
{/each}
<div id="dialog-root"></div>
<div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
