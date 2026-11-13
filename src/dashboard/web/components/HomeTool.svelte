<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { onDestroy } from 'svelte';
  import { api } from '../utils/api.js';
  import { copyText } from '../utils/copy-field.js';
  import Icon from './Icon.svelte';
  import CopyIcon from './friends/CopyIcon.svelte';

  export let definition;
  export let connection;
  export let showToast;
  const key = definition.key;
  const prefix = `home-tool-${key}`;
  const fieldsByType = {
    user: [
      {
        name: 'userId',
        label: '유저 ID',
        search: true,
        numeric: true,
        max: 19,
        placeholder: '유저 ID 입력 (예: 123456789)',
        mode: 'single'
      },
      {
        name: 'userIds',
        label: '유저 ID',
        search: true,
        placeholder: '유저 ID 입력 (예: 123456789,987654321)',
        mode: 'multiple'
      }
    ],
    channel: [
      { name: 'channelId', label: '채팅방 ID', search: true, numeric: true, max: 19, placeholder: '채팅방 ID 입력' }
    ],
    enter: [
      { name: 'channelId', label: '채팅방 ID', search: true, numeric: true, max: 19, placeholder: '채팅방 ID 입력' }
    ],
    message: [
      { name: 'channelId', label: '채팅방 ID', numeric: true, max: 19, placeholder: '채팅방 ID 입력' },
      {
        name: 'messageId',
        label: '메세지 ID',
        search: true,
        numeric: true,
        max: 19,
        placeholder: '메세지 ID 입력 (예: 123456789)',
        mode: 'single'
      },
      {
        name: 'messageIds',
        label: '메세지 ID',
        search: true,
        placeholder: '메세지 ID 입력 (예: 123456789,987654321)',
        mode: 'multiple'
      }
    ],
    decrypt: [
      { name: 'ciphertext', label: '암호문', multiline: true, placeholder: '암호화된 값 입력' },
      { name: 'enc', label: 'enc (생략 시 31)', numeric: true, placeholder: 'enc 값 입력' },
      {
        name: 'userId',
        label: '유저 ID (생략 시 내 ID)',
        numeric: true,
        max: 19,
        placeholder: '유저 ID 입력'
      }
    ],
    query: [
      {
        name: 'sql',
        label: 'SQL Query',
        multiline: true,
        max: 3000,
        placeholder: 'SELECT * FROM db1.chat_rooms LIMIT ?'
      },
      { name: 'params', label: '매개변수 (선택)', placeholder: '[20]' },
      { name: 'limit', label: '최대 행 수 (선택)', numeric: true, placeholder: '생략 시 기본 100행' }
    ]
  };
  const fields = fieldsByType[key];
  const values = Object.fromEntries(fields.map((field) => [field.name, '']));
  const multi = key === 'user' || key === 'message';
  let mode = 'single';
  let busy = false;
  let status = '';
  let isError = false;
  let invalid = '';
  let result = null;
  let version = 0;
  let controller;
  let timeout;
  let previousConnection = connection;
  $: if (connection !== previousConnection) {
    previousConnection = connection;
    if (busy && connection !== 'connected') {
      cancel();
      status =
        key === 'enter'
          ? '연결 상태가 바뀌어 요청 응답을 확인하지 못했습니다. 연결된 카카오톡을 확인해 주세요.'
          : key === 'decrypt'
            ? '연결 상태가 바뀌어 복호화를 중단했습니다. 다시 연결한 뒤 시도해 주세요.'
            : '연결 상태가 바뀌어 조회를 중단했습니다. 다시 연결한 뒤 조회해 주세요.';
      isError = true;
    }
  }
  $: submitLabel = busy
    ? key === 'enter'
      ? '열기 요청 중…'
      : key === 'decrypt'
        ? '복호화 중…'
        : key === 'query'
          ? '확인 중…'
          : '조회 중…'
    : key === 'channel'
      ? '채팅방 조회'
      : key === 'enter'
        ? '카카오톡에서 채팅방 열기'
        : key === 'message'
          ? mode === 'multiple'
            ? '여러 개 메세지 조회'
            : '메세지 조회'
          : key === 'user'
            ? mode === 'multiple'
              ? '여러 명 조회'
              : '유저 조회'
            : key === 'decrypt'
              ? '복호화'
              : '조회';
  $: connectionNote =
    connection === 'unavailable'
      ? key === 'enter'
        ? '채팅방을 열 계정을 선택해 주세요.'
        : '사용할 계정을 선택해 주세요.'
      : key === 'enter'
        ? 'Arisa 서버에 연결되면 채팅방을 열 수 있습니다.'
        : 'Arisa 서버에 연결되면 사용할 수 있습니다.';
  $: resultText = result === null ? '' : key === 'decrypt' ? result.plaintext : JSON.stringify(result, null, 2);
  $: resultLabel = `${definition.label} 응답 JSON`;
  $: resultCount =
    result === null
      ? ''
      : key === 'decrypt'
        ? '복호화 결과'
        : key === 'message'
          ? `메세지 ${result.messages.length}개`
          : key === 'query'
            ? `${result.count ?? result.rows?.length ?? 0}행`
            : key === 'user' && Array.isArray(result.results)
              ? `${result.count}명 · 성공 ${result.successCount}명 · 실패 ${result.failureCount}명`
              : resultLabel;

  function cancel() {
    version += 1;
    clearTimeout(timeout);
    controller?.abort();
    controller = undefined;
    busy = false;
  }
  onDestroy(cancel);

  function changeMode(next, focus = false) {
    if (mode !== next) {
      cancel();
      mode = next;
      result = null;
      invalid = '';
      status = '';
      isError = false;
    }
    if (focus) document.getElementById(`${prefix}-${next}-tab`)?.focus();
  }
  function tabKey(event, current) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    changeMode(
      event.key === 'Home' ? 'single' : event.key === 'End' ? 'multiple' : current === 'single' ? 'multiple' : 'single',
      true
    );
  }
  function paste(event) {
    const text = event.clipboardData?.getData('text');
    if (!text || !/[\r\n]/u.test(text)) return;
    event.preventDefault();
    const input = event.currentTarget;
    input.setRangeText(
      text.replace(/\r\n|[\r\n]/gu, ','),
      input.selectionStart ?? input.value.length,
      input.selectionEnd ?? input.value.length,
      'end'
    );
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function fail(name, text) {
    invalid = name;
    document.getElementById(`${prefix}-${name}`)?.focus();
    throw new Error(text);
  }
  function idValue(name, label) {
    const value = values[name].trim();
    if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
      fail(name, `${label}를 올바르게 입력해 주세요.`);
    return value;
  }
  function idValues(name, label) {
    const items = values[name]
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!items.length) fail(name, `조회할 ${label}를 입력해 주세요.`);
    for (const [index, value] of items.entries())
      if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n)
        fail(name, `${index + 1}번째 ${label}를 올바르게 입력해 주세요.`);
    return [...new Set(items)];
  }
  function post(path, data) {
    return [
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Arisa-Dashboard': '1' },
        body: JSON.stringify(data)
      }
    ];
  }
  function request() {
    if (key === 'enter') return post('/tools/channel/enter', { channelId: idValue('channelId', '채팅방 ID') });
    if (key === 'channel')
      return [`/tools/channel?channelId=${encodeURIComponent(idValue('channelId', '채팅방 ID'))}`, {}];
    if (key === 'user')
      return mode === 'multiple'
        ? post('/tools/users', { userIds: idValues('userIds', '유저 ID') })
        : [`/tools/user?userId=${encodeURIComponent(idValue('userId', '유저 ID'))}`, {}];
    if (key === 'message')
      return post('/tools/messages', {
        channelId: idValue('channelId', '채팅방 ID'),
        messageIds: mode === 'multiple' ? idValues('messageIds', '메세지 ID') : [idValue('messageId', '메세지 ID')]
      });
    if (key === 'decrypt') {
      if (!values.ciphertext.trim()) fail('ciphertext', '복호화할 암호문을 입력해 주세요.');
      const enc = values.enc.trim() ? Number(values.enc) : 31;
      if (!Number.isInteger(enc) || enc < 0 || enc > 4294967295)
        fail('enc', 'enc를 0부터 4294967295까지의 정수로 입력해 주세요.');
      return post('/tools/decrypt', {
        ciphertext: values.ciphertext,
        enc,
        userId: values.userId.trim() ? idValue('userId', '유저 ID') : undefined
      });
    }
    const sql = values.sql.trim();
    if (!sql) fail('sql', '조회할 SQL을 입력해 주세요.');
    let params;
    try {
      params = values.params.trim() ? JSON.parse(values.params) : [];
      if (
        !Array.isArray(params) ||
        params.length > 100 ||
        params.some(
          (value) =>
            value !== null &&
            (typeof value === 'object' ||
              !['string', 'number', 'boolean'].includes(typeof value) ||
              (typeof value === 'number' &&
                (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))))
        )
      )
        throw new Error();
    } catch {
      fail('params', '매개변수는 JSON 배열로 입력해 주세요. 큰 숫자 ID는 문자열로 감싸 주세요.');
    }
    const limit = values.limit.trim() ? Number(values.limit) : undefined;
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 4294967295))
      fail('limit', '최대 행 수는 1부터 4294967295까지의 정수로 입력해 주세요.');
    return post('/tools/query', { sql, params, limit });
  }
  async function run() {
    if (busy || connection !== 'connected') return;
    result = null;
    invalid = '';
    let path;
    let options;
    try {
      [path, options] = request();
    } catch (error) {
      status = error.message;
      isError = true;
      return;
    }
    busy = true;
    isError = false;
    status = key === 'enter' ? '열기 요청 중…' : key === 'decrypt' ? '복호화 중…' : '조회 중…';
    const requestVersion = ++version;
    const requestController = new AbortController();
    controller = requestController;
    timeout = setTimeout(() => {
      if (requestVersion !== version) return;
      cancel();
      isError = true;
      status =
        key === 'enter'
          ? '요청 응답을 확인하지 못했습니다. 연결된 카카오톡을 확인해 주세요.'
          : key === 'decrypt'
            ? '복호화 시간이 초과되었습니다. 다시 시도해 주세요.'
            : '조회 시간이 초과되었습니다. 다시 시도해 주세요.';
    }, 20_000);
    try {
      const value = await api(path, { ...options, signal: requestController.signal });
      if (requestVersion !== version) return;
      if (key === 'enter' && value.queued !== true)
        throw new Error('요청 응답을 확인하지 못했습니다. 연결된 카카오톡을 확인해 주세요.');
      result = value;
      status = '';
    } catch (error) {
      if (requestVersion !== version || error.name === 'AbortError') return;
      isError = true;
      status =
        key === 'enter' && error.status === undefined && !error.code
          ? '요청 응답을 확인하지 못했습니다. 연결된 카카오톡을 확인해 주세요.'
          : error.message ||
            (key === 'decrypt'
              ? '복호화하지 못했습니다. 다시 시도해 주세요.'
              : '조회하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (requestVersion === version) {
        clearTimeout(timeout);
        controller = undefined;
        busy = false;
      }
    }
  }
  async function copy(event) {
    try {
      await copyText(event.currentTarget, resultText);
      showToast('결과를 복사했습니다.');
    } catch {
      showToast('복사하지 못했습니다. 내용을 선택해 복사해 주세요.', true);
    }
  }
</script>

<section class={`home-tool-card is-${key}`} id={`${prefix}-panel`} aria-labelledby={`${prefix}-title`}>
  <div class="home-tool-input-panel">
    <header class="home-tool-heading">
      <h3 class="home-tool-title" id={`${prefix}-title`} tabindex="-1">
        <Icon name={definition.icon} /><span>{definition.label}</span>
      </h3>
      <p class="home-tool-description">{definition.description}</p>
    </header>
    {#if multi}
      <div class="home-user-tabs" role="tablist" aria-label={key === 'user' ? '유저 조회 인원' : '메세지 조회 개수'}>
        {#each ['single', 'multiple'] as option}
          <button
            type="button"
            class="home-user-tab"
            id={`${prefix}-${option}-tab`}
            role="tab"
            aria-controls={`${prefix}-mode-panel`}
            aria-selected={mode === option}
            tabindex={mode === option ? 0 : -1}
            on:click={() => changeMode(option)}
            on:keydown={(event) => tabKey(event, option)}
            >{key === 'user'
              ? option === 'single'
                ? '한 명 조회'
                : '여러 명 조회'
              : option === 'single'
                ? '한 개 조회'
                : '여러 개 조회'}</button
          >
        {/each}
      </div>
    {/if}
    <div
      class:home-user-panel={multi}
      class="home-tool-body"
      id={multi ? `${prefix}-mode-panel` : undefined}
      role={multi ? 'tabpanel' : undefined}
      aria-labelledby={multi ? `${prefix}-${mode}-tab` : undefined}
    >
      <form class="home-tool-form" class:has-error={isError} novalidate aria-busy={busy} on:submit|preventDefault={run}>
        <div class="home-tool-fields">
          {#each fields as field (field.name)}
            <div class="home-tool-field" class:is-wide={field.multiline} hidden={field.mode && field.mode !== mode}>
              <label for={`${prefix}-${field.name}`}>{field.label}</label>
              {#if field.search}
                <input
                  class="home-tool-input"
                  id={`${prefix}-${field.name}`}
                  name={field.name}
                  type="text"
                  bind:value={values[field.name]}
                  placeholder={field.placeholder}
                  inputmode={field.numeric ? 'numeric' : undefined}
                  maxlength={field.max}
                  autocomplete="off"
                  spellcheck="false"
                  aria-describedby={`${prefix}-status`}
                  aria-invalid={invalid === field.name}
                  disabled={busy || Boolean(field.mode && field.mode !== mode)}
                  enterkeyhint={key === 'enter' ? 'go' : 'search'}
                  on:paste={paste}
                  on:keydown={(event) => {
                    if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229)) event.preventDefault();
                  }}
                />
              {:else if field.multiline}
                <textarea
                  class="home-tool-input"
                  id={`${prefix}-${field.name}`}
                  name={field.name}
                  bind:value={values[field.name]}
                  placeholder={field.placeholder}
                  rows="3"
                  maxlength={field.max}
                  spellcheck="false"
                  aria-describedby={`${prefix}-status`}
                  aria-invalid={invalid === field.name}
                  disabled={busy}></textarea>
              {:else}
                <input
                  class="home-tool-input"
                  id={`${prefix}-${field.name}`}
                  name={field.name}
                  type="text"
                  bind:value={values[field.name]}
                  placeholder={field.placeholder}
                  inputmode={field.numeric ? 'numeric' : undefined}
                  maxlength={field.max}
                  autocomplete="off"
                  spellcheck="false"
                  aria-describedby={`${prefix}-status`}
                  aria-invalid={invalid === field.name}
                  disabled={busy}
                />
              {/if}
            </div>
          {/each}
        </div>
        {#if key === 'query'}<p class="home-tool-hint">
            SELECT 또는 WITH로 시작하는 조회만 가능합니다. 매개변수는 JSON 배열로 입력해 주세요.
          </p>{/if}
        <div class="home-tool-actions">
          <p class="home-tool-connection-note" hidden={connection === 'connected'}>{connectionNote}</p>
          <button class="home-tool-submit" type="submit" disabled={busy || connection !== 'connected'}
            ><Icon name={key === 'decrypt' ? 'decrypt' : key === 'enter' ? 'channel-enter' : 'lookup-search'} /><span
              >{submitLabel}</span
            ></button
          >
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
  {#if result !== null}
    <section class="home-tool-output" aria-labelledby={`${prefix}-result-title`} aria-busy={busy}>
      <header class="home-query-header">
        <div class="home-query-heading">
          <h4 class="home-query-title" id={`${prefix}-result-title`}>결과</h4>
          <p class="home-query-count" hidden={result === null}>{resultCount}</p>
        </div>
        <button class="home-query-copy" type="button" aria-label="결과 복사" title="결과 복사" on:click={copy}>
          <CopyIcon />
        </button>
      </header>
      <div class="home-tool-result">
        <div class="home-query-result">
          <!-- svelte-ignore a11y_no_noninteractive_tabindex: keyboard users can scroll long results. -->
          <pre
            class="home-query-json"
            tabindex="0"
            aria-label={key === 'decrypt' ? '복호화 원문' : resultLabel}>{resultText}</pre>
        </div>
      </div>
    </section>
  {/if}
</section>
