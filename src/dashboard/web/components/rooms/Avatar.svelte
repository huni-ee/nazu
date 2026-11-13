<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Icon from '../Icon.svelte';
  import { safeImageUrl } from '../../utils/profile.js';

  export let url = '';
  export let small = false;
  export let fallback = 'user';
  export let className = '';

  let imageUrl = '';
  let loaded = false;
  let failed = false;
  $: src = safeImageUrl(url);
  $: if (src !== imageUrl) {
    imageUrl = src;
    loaded = false;
    failed = false;
  }
</script>

<span class="profile {className}" class:profile-small={small}>
  {#if !loaded}<span class="profile-fallback"><Icon name={fallback} /></span>{/if}
  {#if src && !failed}<img
      {src}
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      onload={() => (loaded = true)}
      onerror={() => (failed = true)}
    />{/if}
</span>
