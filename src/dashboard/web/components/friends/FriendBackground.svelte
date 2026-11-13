<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import { safeImageUrl } from '../../utils/profile.js';
  import { profileVideo } from './profile-video.js';
  export let profileData;
  export let bridge;
  export let available = false;

  $: imageSrc =
    safeImageUrl(profileData?.backgroundImage?.mediumUrl) || safeImageUrl(profileData?.backgroundImage?.originalUrl);
  $: videoSrc =
    safeImageUrl(profileData?.backgroundImage?.mediumAnimatedUrl) ||
    safeImageUrl(profileData?.backgroundImage?.originalAnimatedUrl);
  let failedImage = '';
  let failedVideo = '';
  $: imageUrl = imageSrc === failedImage ? '' : imageSrc;
  $: animatedUrl = videoSrc === failedVideo ? '' : videoSrc;
  $: originalUrl = safeImageUrl(profileData?.backgroundImage?.originalUrl);
  $: originalAnimated = safeImageUrl(profileData?.backgroundImage?.originalAnimatedUrl) || videoSrc;
  $: label = originalAnimated ? '움직이는 배경 원본 보기' : '배경 사진 원본 보기';
  $: clickable = Boolean(originalUrl || originalAnimated);
  $: available = Boolean(imageUrl || animatedUrl);

  function show(event) {
    if (originalAnimated) bridge.showVideoViewer(originalAnimated, originalUrl || imageUrl, label, event.currentTarget);
    else bridge.showImageViewer(originalUrl, label, { trigger: event.currentTarget });
  }
</script>

{#snippet preview()}
  {#key imageUrl}{#if imageUrl}<img
        class="friend-detail-background"
        class:friend-image-preview={clickable}
        src={imageUrl}
        alt=""
        loading="eager"
        referrerpolicy="no-referrer"
        onerror={() => {
          failedImage = imageUrl;
        }}
      />{:else if animatedUrl}<div
        class="friend-detail-background"
        class:friend-image-preview={clickable}
      ></div>{/if}{/key}
  {#key animatedUrl}{#if animatedUrl}<video
        class="friend-animated-video friend-detail-background-video"
        src={animatedUrl}
        poster={imageUrl || undefined}
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        disablepictureinpicture
        referrerpolicy="no-referrer"
        tabindex="-1"
        aria-hidden="true"
        use:profileVideo
        onerror={() => {
          failedVideo = animatedUrl;
        }}
      ></video>{/if}{/key}
{/snippet}

{#if imageUrl || animatedUrl}
  {#if clickable}
    <button
      type="button"
      class="friend-image-button friend-background-button"
      aria-label={label}
      title={label}
      onclick={show}>{@render preview()}</button
    >
  {:else}
    {@render preview()}
  {/if}
{/if}
