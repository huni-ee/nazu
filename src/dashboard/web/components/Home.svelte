<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { onDestroy } from 'svelte';
  import { api } from '../utils/api.js';
  import Icon from './Icon.svelte';
  import HomeTool from './HomeTool.svelte';
  import HomeRoomAction from './HomeRoomAction.svelte';
  import HomeMediaAction from './HomeMediaAction.svelte';

  export let state;
  export let showToast;

  const groups = [
    {
      key: 'lookup',
      label: '정보 조회',
      tools: [
        {
          key: 'user',
          label: '유저 조회',
          icon: 'user',
          description: '유저 ID로 유저 정보를 확인합니다.'
        },
        {
          key: 'channel',
          label: '채팅방 조회',
          icon: 'chat',
          description: '채팅방 ID로 채팅방 정보를 확인합니다.'
        },
        {
          key: 'message',
          label: '메세지 조회',
          icon: 'message-search',
          description: '채팅방 ID와 메세지 ID로 메세지를 확인합니다.'
        }
      ]
    },
    {
      key: 'room',
      label: '채팅방',
      tools: [
        {
          key: 'enter',
          label: '채팅방 열기',
          icon: 'channel-enter',
          description: '채팅방 ID로 카카오톡 채팅방을 엽니다.'
        },
        {
          key: 'read',
          label: '읽음 처리',
          icon: 'check',
          description: '채팅방 ID로 메세지를 읽음 처리합니다.'
        },
        {
          key: 'send',
          label: '메세지 전송',
          icon: 'send',
          description: '채팅방이나 스레드에 메세지를 보냅니다.'
        },
        {
          key: 'media',
          label: '미디어 전송',
          icon: 'paperclip',
          description: '채팅방에 사진, 동영상, 음성 또는 파일을 보냅니다.'
        }
      ]
    },
    {
      key: 'data',
      label: '데이터 도구',
      tools: [
        {
          key: 'decrypt',
          label: '복호화',
          icon: 'decrypt',
          description: '메세지를 복호화합니다.'
        },
        {
          key: 'query',
          label: 'SQL 조회',
          icon: 'database',
          description: '카카오톡 데이터베이스를 조회합니다.'
        }
      ]
    }
  ];
  let busy = false;
  let result = null;
  let errorMessage = '';
  let controller;
  let timeout;
  let version = 0;
  let previous = '';

  $: connection = $state.connection;
  $: connectionId = $state.connectionId || '';
  $: available = Boolean(connectionId) && (connection === 'connected' || connection === 'disconnected');
  $: displayState = busy
    ? 'checking'
    : connection === 'unavailable'
      ? 'unavailable'
      : !available
        ? 'checking'
        : errorMessage || !result?.connected || connection === 'disconnected'
          ? 'disconnected'
          : 'connected';
  $: label = busy
    ? '연결 확인 중…'
    : connection === 'unavailable'
      ? '대시보드 연결 안 됨'
      : !available
        ? connectionId
          ? '연결 확인 대기'
          : '계정 선택 필요'
        : displayState === 'connected'
          ? 'Arisa 연결됨'
          : 'Arisa 연결 안 됨';
  $: checkedAt = typeof result?.checkedAt === 'string' ? new Date(result.checkedAt) : null;
  $: checkedTime =
    checkedAt && Number.isFinite(checkedAt.getTime())
      ? `${checkedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 확인`
      : '';
  $: meta = busy
    ? '선택한 서버의 응답을 확인하고 있습니다.'
    : connection === 'unavailable'
      ? '대시보드 서버 연결을 확인해 주세요.'
      : !available
        ? '계정 연결 정보를 불러오고 있습니다.'
        : [Number.isFinite(result?.latencyMs) ? `${result.latencyMs} ms` : '', checkedTime].filter(Boolean).join(' · ');
  $: message = busy
    ? ''
    : errorMessage ||
      (typeof result?.error === 'string' ? result.error : '') ||
      (result && connection === 'disconnected' && result.connected
        ? '서버가 응답했지만 Arisa 연결은 아직 준비되지 않았습니다.'
        : '');
  $: key = `${connectionId}:${connection}`;
  $: if (key !== previous) {
    previous = key;
    cancel();
    result = null;
    errorMessage = '';
    if (available) void check();
  }

  function cancel() {
    version += 1;
    clearTimeout(timeout);
    controller?.abort();
    controller = undefined;
    busy = false;
  }

  async function check() {
    if (busy || !available) return;
    busy = true;
    errorMessage = '';
    const requestVersion = ++version;
    const requestController = new AbortController();
    controller = requestController;
    timeout = setTimeout(() => {
      if (requestVersion !== version) return;
      cancel();
      result = null;
      errorMessage = '연결 확인 시간이 초과되었습니다. 다시 시도해 주세요.';
    }, 20_000);
    try {
      const response = await api('/tools/health', { signal: requestController.signal });
      if (requestVersion !== version) return;
      if (typeof response?.connected !== 'boolean') throw new Error('연결 상태를 확인하지 못했습니다.');
      result = response;
    } catch (error) {
      if (requestVersion !== version) return;
      result = null;
      errorMessage = error.message || '연결 상태를 확인하지 못했습니다. 다시 시도해 주세요.';
    } finally {
      if (requestVersion === version) {
        clearTimeout(timeout);
        controller = undefined;
        busy = false;
      }
    }
  }
  onDestroy(cancel);
</script>

<div class="home-content">
  <header class="home-intro">
    <div class="home-intro-copy">
      <h1 class="home-title">Arisa Dashboard</h1>
      <p class="home-description">연결된 계정의 정보를 확인하고 도구를 사용하세요.</p>
    </div>
    <section class="home-connection" data-state={displayState} aria-label="Arisa 연결 확인" aria-busy={busy}>
      <div class="home-connection-header">
        <span class="home-connection-dot" aria-hidden="true"></span>
        <span class="home-connection-label" role="status" aria-live="polite">{label}</span>
        <button
          class="icon-button home-connection-refresh"
          type="button"
          aria-label="연결 다시 확인"
          title="연결 다시 확인"
          disabled={busy || !available}
          on:click={check}><Icon name="refresh" /></button
        >
      </div>
      <p class="home-connection-target" hidden={!result?.target}>{result?.target || ''}</p>
      <p class="home-connection-meta" hidden={!meta}>{meta}</p>
      <p class="home-connection-message" hidden={!message}>{message}</p>
    </section>
  </header>
  <p class="home-connection-note" hidden={connection !== 'disconnected' && connection !== 'unavailable'}>
    계정을 선택하고 연결 상태를 확인해 주세요.
  </p>
  <div class="home-tool-workspace">
    {#each groups as group (group.key)}
      <section class={`home-tool-group is-${group.key}`} aria-labelledby={`home-tool-group-${group.key}`}>
        <h2 class="home-tool-group-title" id={`home-tool-group-${group.key}`}>{group.label}</h2>
        <div class="home-tool-group-list">
          {#each group.tools as definition (definition.key)}
            <div class={`home-tool-slot is-${definition.key}`}>
              {#if definition.key === 'media'}
                <HomeMediaAction {definition} {connection} {connectionId} />
              {:else if definition.key === 'send' || definition.key === 'read'}
                <HomeRoomAction {definition} {connection} {connectionId} />
              {:else}
                <HomeTool {definition} {connection} {showToast} />
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>
