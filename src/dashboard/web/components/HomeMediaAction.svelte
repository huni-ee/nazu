<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { onDestroy } from 'svelte';
  import { api, getActiveConnectionId } from '../utils/api.js';
  import { uploadMedia } from '../utils/media-upload.js';
  import Icon from './Icon.svelte';

  export let definition;
  export let connection;
  export let connectionId;

  const formats = [
    { label: '이미지', extensions: 'jpg, jpeg, gif, bmp, png, tif, tiff, tga, psd, ai' },
    { label: '동영상', extensions: 'mp4, m4v, avi, asf, wmv, mkv, ts, mpg, mpeg, mov, flv, ogv' },
    { label: '음성', extensions: 'mp3, wav, flac, tta, tak, aac, wma, ogg, m4a' },
    {
      label: '문서',
      extensions:
        'doc, docx, hwp, txt, rtf, xml, pdf, wks, xps, md, odf, odt, ods, odp, csv, tsv, xls, xlsx, ppt, pptx, pages, key, numbers, show, ce'
    },
    { label: '압축 파일', extensions: 'zip, gz, bz2, rar, 7z, lzh, alz' }
  ];
  const extensions = formats.flatMap(({ extensions }) => extensions.split(', '));
  const audioExtensions = formats.find((format) => format.label === '음성').extensions.split(', ');
  const maxAudioSize = 10 * 1024 * 1024;
  const maxFileSize = 300 * 1024 * 1024;
  const accept = extensions.map((extension) => `.${extension}`).join(',');
  const prefix = 'home-tool-media';
  let channelId = '';
  let mode = 'single';
  let files = [];
  let fileInput;
  let busy = false;
  let status = '';
  let invalid = '';
  let isError = false;
  let controller;
  let version = 0;
  let previousKey;
  let previousConnectionId = connectionId;

  $: key = `${connectionId}:${connection}`;
  $: if (key !== previousKey) {
    previousKey = key;
    if (busy) {
      cancel();
      isError = true;
      status = '연결이 변경되어 전송 결과를 확인하지 못했습니다. 카카오톡에서 확인해 주세요.';
    }
    if (connectionId !== previousConnectionId) {
      previousConnectionId = connectionId;
      channelId = '';
      clearFiles();
      invalid = '';
      if (!isError) status = '';
    }
  }

  function cancel() {
    version += 1;
    controller?.abort();
    controller = undefined;
    busy = false;
  }
  onDestroy(cancel);

  function clearFiles() {
    files = [];
    if (fileInput) fileInput.value = '';
  }

  function changeMode(value) {
    mode = value;
    clearFiles();
    invalid = '';
    status = '';
    isError = false;
  }

  function selectFiles(event) {
    files = Array.from(event.currentTarget.files || []);
    invalid = '';
    status = '';
    isError = false;
    if (files.some((file) => file.size > maxFileSize)) fail('files', '파일 하나의 용량을 300MB 이하로 줄여 주세요.');
    else if (hasOversizedAudio()) fail('files', 'Multiple로 전송하는 오디오 파일은 10MB 이하로 용량을 줄여 주세요.');
  }

  function hasOversizedAudio() {
    return (
      mode === 'multiple' &&
      files.some(
        (file) =>
          (audioExtensions.includes(file.name.split('.').pop().toLowerCase()) || file.type.startsWith('audio/')) &&
          file.size > maxAudioSize
      )
    );
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
    if (!/^[1-9]\d{0,18}$/.test(room) || BigInt(room) > 9223372036854775807n)
      return fail('channelId', '채팅방 ID를 올바르게 입력해 주세요.');
    if (!files.length) return fail('files', '전송할 파일을 선택해 주세요.');
    if (files.some((file) => !extensions.includes(file.name.split('.').pop().toLowerCase())))
      return fail('files', '지원하는 파일 형식을 선택해 주세요.');
    if (files.some((file) => file.size > maxFileSize))
      return fail('files', '파일 하나의 용량을 300MB 이하로 줄여 주세요.');
    if (hasOversizedAudio()) return fail('files', 'Multiple로 전송하는 오디오 파일은 10MB 이하로 용량을 줄여 주세요.');

    busy = true;
    status = '파일 전송 준비 중…';
    const requestVersion = ++version;
    const requestController = new AbortController();
    const account = connectionId;
    controller = requestController;
    const request = (path, options = {}) => {
      if (account !== getActiveConnectionId()) throw new Error('선택한 계정이 변경되었습니다.');
      return api(`/channels/${room}${path}`, {
        ...options,
        ...(options.method !== 'DELETE' ? { signal: requestController.signal } : {})
      });
    };
    try {
      await uploadMedia(request, files, mode, (sent, total) => {
        if (requestVersion !== version) return;
        status = `파일 전송 중… ${total ? Math.round((sent / total) * 100) : 0}%`;
      });
      if (requestVersion !== version) return;
      status = '미디어를 전송했습니다.';
      clearFiles();
    } catch (error) {
      if (requestVersion !== version) return;
      isError = true;
      status = error.message || '파일을 전송하지 못했습니다. 다시 시도해 주세요.';
    } finally {
      if (requestVersion === version) {
        controller = undefined;
        busy = false;
      }
    }
  }
</script>

<section class="home-tool-card is-media" id={`${prefix}-panel`} aria-labelledby={`${prefix}-title`}>
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
                if (event.key === 'Enter') event.preventDefault();
              }}
            />
          </div>
          <fieldset class="home-media-mode" disabled={busy}>
            <legend>전송 방식</legend>
            <div class="home-media-mode-options">
              <label
                ><input
                  type="radio"
                  name="media-mode"
                  value="single"
                  checked={mode === 'single'}
                  on:change={() => changeMode('single')}
                /> Single</label
              >
              <label
                ><input
                  type="radio"
                  name="media-mode"
                  value="multiple"
                  checked={mode === 'multiple'}
                  on:change={() => changeMode('multiple')}
                /> Multiple</label
              >
            </div>
            <p>Multiple로 전송하는 오디오 파일은 음성 메세지로 전송되며, 파일당 최대 10MB입니다.</p>
          </fieldset>
          <div class="home-tool-field">
            <label for={`${prefix}-files`}>파일</label>
            <input
              class="home-tool-input home-media-file-input"
              id={`${prefix}-files`}
              type="file"
              {accept}
              multiple={mode === 'multiple'}
              bind:this={fileInput}
              aria-describedby={`${prefix}-status`}
              aria-invalid={invalid === 'files'}
              disabled={busy}
              on:change={selectFiles}
            />
            <p class="home-tool-hint">파일 하나당 최대 300MB까지 전송할 수 있습니다.</p>
            <details class="home-media-formats">
              <summary>
                <span class="home-media-format-chevron" aria-hidden="true"><Icon name="chevron-right" /></span>
                <span>지원하는 파일 형식</span>
              </summary>
              <dl>
                {#each formats as format (format.label)}
                  <div>
                    <dt>{format.label}</dt>
                    <dd>{format.extensions}</dd>
                  </div>
                {/each}
              </dl>
            </details>
          </div>
        </div>
        <div class="home-tool-actions">
          <p class="home-tool-connection-note" hidden={connection === 'connected'}>
            Arisa 서버에 연결되면 사용할 수 있습니다.
          </p>
          <button class="home-tool-submit" type="submit" disabled={busy || connection !== 'connected'}>
            <Icon name="paperclip" /><span>{busy ? '전송 중…' : '미디어 전송'}</span>
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
