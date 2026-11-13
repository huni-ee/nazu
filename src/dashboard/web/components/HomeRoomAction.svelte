<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { onDestroy } from 'svelte';
  import { api } from '../utils/api.js';
  import Icon from './Icon.svelte';

  export let definition;
  export let connection;
  export let connectionId;

  const isSend = definition.key === 'send';
  const prefix = `home-tool-${definition.key}`;
  let channelId = '';
  let text = '';
  let threadId = '';
  let controller;
  let timeout;
  let version = 0;
  let busy = false;
  let status = '';
  let isError = false;
  let invalid = '';
  let previousKey;
  let previousConnectionId = connectionId;

  $: key = `${connectionId}:${connection}`;
  $: if (key !== previousKey) {
    previousKey = key;
    if (connectionId !== previousConnectionId) {
      previousConnectionId = connectionId;
      channelId = '';
      threadId = '';
      status = '';
      isError = false;
      invalid = '';
    }
    if (busy) {
      cancel();
      isError = true;
      status = '연결이 변경되어 요청 결과를 확인하지 못했습니다. 카카오톡에서 처리 여부를 확인해 주세요.';
    }
  }

  function cancel() {
    version += 1;
    clearTimeout(timeout);
    controller?.abort();
    controller = undefined;
    busy = false;
  }
  onDestroy(cancel);

  function validId(value) {
    return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
  }

  function fail(field, message) {
    invalid = field;
    isError = true;
    status = message;
    document.getElementById(`${prefix}-${field}`)?.focus();
  }

  async function run() {
    if (busy || connection !== 'connected') return;
    status = '';
    isError = false;
    invalid = '';
    const room = channelId.trim();
    const thread = threadId.trim();
    if (!validId(room)) return fail('channelId', '채팅방 ID를 올바르게 입력해 주세요.');
    if (isSend && !text.trim()) return fail('text', '전송할 메세지를 입력해 주세요.');
    if (isSend && thread && !validId(thread)) return fail('threadId', '스레드 ID를 올바르게 입력해 주세요.');

    const data = isSend ? { text, ...(thread ? { threadId: thread } : {}) } : {};
    busy = true;
    status = isSend ? '메세지 전송 요청 중…' : '읽음 처리 요청 중…';
    const requestVersion = ++version;
    const requestController = new AbortController();
    controller = requestController;
    timeout = setTimeout(() => {
      if (requestVersion !== version) return;
      cancel();
      isError = true;
      status = '요청 결과를 확인하지 못했습니다. 다시 요청하기 전에 카카오톡에서 처리 여부를 확인해 주세요.';
    }, 20_000);
    try {
      const response = await api(`/channels/${room}/${isSend ? 'messages' : 'read'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Arisa-Dashboard': '1' },
        body: JSON.stringify(data),
        signal: requestController.signal
      });
      if (requestVersion !== version) return;
      if (response.queued !== true || response.channelId !== room)
        throw new Error('요청 결과를 확인하지 못했습니다. 카카오톡에서 처리 여부를 확인해 주세요.');
      status = isSend ? '메세지 전송을 요청했습니다.' : '읽음 처리를 요청했습니다.';
      if (isSend) text = '';
    } catch (error) {
      if (requestVersion !== version || error.name === 'AbortError') return;
      isError = true;
      status =
        error.status === undefined && !error.code
          ? '요청 결과를 확인하지 못했습니다. 다시 요청하기 전에 카카오톡에서 처리 여부를 확인해 주세요.'
          : error.message || '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
    } finally {
      if (requestVersion === version) {
        clearTimeout(timeout);
        controller = undefined;
        busy = false;
      }
    }
  }
</script>

<section class={`home-tool-card is-${definition.key}`} id={`${prefix}-panel`} aria-labelledby={`${prefix}-title`}>
  <div class="home-tool-input-panel">
    <header class="home-tool-heading">
      <h3 class="home-tool-title" id={`${prefix}-title`}>
        <Icon name={definition.icon} /><span>{definition.label}</span>
      </h3>
      <p class="home-tool-description">{definition.description}</p>
    </header>
    <div class="home-tool-body">
      <form class="home-tool-form" novalidate aria-busy={busy} on:submit|preventDefault={run}>
        <div class="home-tool-fields">
          <div class="home-tool-field">
            <label for={`${prefix}-channelId`}>채팅방 ID</label>
            <input
              class="home-tool-input"
              id={`${prefix}-channelId`}
              name="channelId"
              type="text"
              bind:value={channelId}
              placeholder="채팅방 ID 입력"
              inputmode="numeric"
              maxlength="19"
              autocomplete="off"
              spellcheck="false"
              aria-describedby={`${prefix}-status`}
              aria-invalid={invalid === 'channelId'}
              disabled={busy}
              on:keydown={(event) => {
                if (event.key === 'Enter' && (isSend || event.isComposing || event.keyCode === 229))
                  event.preventDefault();
              }}
            />
          </div>
          {#if isSend}
            <div class="home-tool-field">
              <label for={`${prefix}-text`}>메세지</label>
              <textarea
                class="home-tool-input home-message-input"
                id={`${prefix}-text`}
                name="text"
                bind:value={text}
                placeholder="메세지 입력"
                rows="3"
                aria-describedby={`${prefix}-status`}
                aria-invalid={invalid === 'text'}
                disabled={busy}></textarea>
            </div>
            <div class="home-tool-field">
              <label for={`${prefix}-threadId`}>스레드 ID (선택)</label>
              <input
                class="home-tool-input"
                id={`${prefix}-threadId`}
                name="threadId"
                type="text"
                bind:value={threadId}
                placeholder="스레드 ID 입력"
                inputmode="numeric"
                maxlength="19"
                autocomplete="off"
                spellcheck="false"
                aria-describedby={`${prefix}-status`}
                aria-invalid={invalid === 'threadId'}
                disabled={busy}
                on:keydown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
              />
            </div>
          {/if}
        </div>
        <div class="home-tool-actions">
          <p class="home-tool-connection-note" hidden={connection === 'connected'}>
            Arisa 서버에 연결되면 사용할 수 있습니다.
          </p>
          <button class="home-tool-submit" type="submit" disabled={busy || connection !== 'connected'}>
            <Icon name={definition.icon} /><span>{busy ? '요청 중…' : definition.label}</span>
          </button>
        </div>
        <p
          class="home-tool-status"
          id={`${prefix}-status`}
          role="status"
          aria-live="polite"
          class:is-error={isError}
          hidden={!status}
        >
          {status}
        </p>
      </form>
    </div>
  </div>
</section>
