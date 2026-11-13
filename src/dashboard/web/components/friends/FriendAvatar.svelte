<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Icon from '../Icon.svelte';
  import { safeImageUrl } from '../../utils/profile.js';
  import { profileVideo } from './profile-video.js';
  export let profileData;
  export let source;
  export let isSelf;
  export let bridge;

  $: imageSrc = isSelf
    ? safeImageUrl(profileData?.profileImage?.mediumUrl) ||
      safeImageUrl(profileData?.profileImage?.originalUrl) ||
      safeImageUrl(source?.originalProfileImageUrl)
    : safeImageUrl(profileData?.profileImage?.mediumUrl) || safeImageUrl(source?.profileImageUrl);
  $: videoSrc =
    safeImageUrl(profileData?.profileImage?.mediumAnimatedUrl) ||
    safeImageUrl(profileData?.profileImage?.originalAnimatedUrl);
  $: originalUrl = safeImageUrl(
    profileData?.profileImage?.originalUrl || (isSelf ? source?.originalProfileImageUrl : undefined)
  );
  $: originalAnimated = safeImageUrl(profileData?.profileImage?.originalAnimatedUrl) || videoSrc;
  $: label = originalAnimated ? '움직이는 프로필 사진 원본 보기' : '프로필 사진 원본 보기';
  $: clickable = Boolean(originalUrl || originalAnimated);
  let loadedImage = '';
  let failedImage = '';
  let failedVideo = '';
  $: url = imageSrc === failedImage ? '' : imageSrc;
  $: animatedUrl = videoSrc === failedVideo ? '' : videoSrc;

  function show(event) {
    if (originalAnimated) bridge.showVideoViewer(originalAnimated, originalUrl || url, label, event.currentTarget);
    else bridge.showImageViewer(originalUrl, label, { trigger: event.currentTarget });
  }
</script>

{#snippet preview()}
  <span class="profile" class:friend-image-preview={clickable} class:friend-detail-avatar={!clickable}>
    {#if !url || loadedImage !== url}<span class="profile-fallback"><Icon name="user" /></span>{/if}
    {#key url}{#if url}<img
          src={url}
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
          onload={() => {
            loadedImage = url;
          }}
          onerror={() => {
            failedImage = url;
          }}
        />{/if}{/key}
    {#key animatedUrl}{#if animatedUrl}<video
          class="friend-animated-video friend-detail-avatar-video"
          src={animatedUrl}
          poster={url || undefined}
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
  </span>
{/snippet}

{#if clickable}
  <button type="button" class="friend-image-button friend-detail-avatar" aria-label={label} title={label} onclick={show}
    >{@render preview()}</button
  >
{:else}
  {@render preview()}
{/if}
