<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Icon from '../Icon.svelte';
  import { safeImageUrl } from '../../utils/profile.js';

  export let profileData;
  let failedImages = new Set();
  $: tracks = (profileData?.musics?.contentsInfo ?? []).filter(
    (track) => typeof track?.contentName === 'string' && track.contentName.trim()
  );

  function failImage(url) {
    failedImages = new Set(failedImages).add(url);
  }
</script>

{#if tracks.length}
  <section class="friend-detail-music">
    <h3>프로필 뮤직</h3>
    <div class="friend-music-list">
      {#each tracks as track}
        {@const cover = safeImageUrl(track.contentThumbImgPath) || safeImageUrl(track.contentImgPath)}
        {@const artists = (track.artistList ?? [])
          .map((artist) => artist?.artistName)
          .filter((name) => typeof name === 'string' && name.trim())
          .join(', ')}
        <article class="friend-music-card">
          <span class="friend-music-placeholder">
            <Icon name="music" />
            {#if cover && !failedImages.has(cover)}
              <img
                class="friend-music-cover"
                src={cover}
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
                onerror={() => failImage(cover)}
              />
            {/if}
          </span>
          <div class="friend-music-info">
            <p class="friend-music-title">{track.contentName}</p>
            {#if artists}<p class="friend-music-artist">{artists}</p>{/if}
            {#if track.albumName?.trim()}<p class="friend-music-album">{track.albumName}</p>{/if}
          </div>
        </article>
      {/each}
    </div>
  </section>
{/if}
