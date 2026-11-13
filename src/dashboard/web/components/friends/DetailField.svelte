<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Icon from '../Icon.svelte';
  import CopyIcon from './CopyIcon.svelte';
  import { copyText } from '../../utils/copy-field.js';

  export let label;
  export let value = '';
  export let icon;
  export let copyValue = '';
  export let datetime = '';
  export let showToast = () => {};

  async function copy(event) {
    try {
      await copyText(event.currentTarget, copyValue);
      showToast(`${label}를 복사했습니다.`);
    } catch {
      showToast('복사하지 못했습니다. 값을 선택해 복사해 주세요.', true);
    }
  }
</script>

<div class="friend-detail-field">
  <Icon name={icon} className="friend-detail-field-icon" />
  <dl class="friend-detail-field-text">
    <dt>{label}</dt>
    <dd>
      {#if datetime}<time {datetime}>{value}</time>{:else}{value}{/if}
    </dd>
  </dl>
  {#if copyValue}
    <button
      type="button"
      class="friend-detail-copy"
      aria-label={`${label} 복사`}
      title={`${label} 복사`}
      onclick={copy}
    >
      <CopyIcon />
    </button>
  {/if}
</div>
