<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Avatar from '../rooms/Avatar.svelte';
  import CopyIcon from './CopyIcon.svelte';
  import { safeImageUrl } from '../../utils/profile.js';

  export let entries;
  export let title;
  export let fallbackName;
  export let imageKey;
  export let linkKind;
  export let bridge;

  function masonry(node) {
    let cleanup = bridge.arrangeMasonryCards(node);
    return {
      update() {
        cleanup?.();
        cleanup = bridge.arrangeMasonryCards(node);
      },
      destroy() {
        cleanup?.();
      }
    };
  }

  function entryDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = typeof value === 'number' ? value : Number(value);
    const timestamp =
      Number.isFinite(numeric) && numeric > 0 ? (numeric < 1_000_000_000_000 ? numeric * 1000 : numeric) : value;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return null;
    return {
      iso: date.toISOString(),
      text: `생성 ${new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(date)}`
    };
  }

  async function copyLink(event, url) {
    try {
      await bridge.copyText(event.currentTarget, url);
      bridge.showToast(`${linkKind} 링크를 복사했습니다.`);
    } catch {
      bridge.showToast('복사하지 못했습니다. 링크를 선택해 복사해 주세요.', true);
    }
  }
</script>

{#if Array.isArray(entries) && entries.length}
  <section class="self-open-profiles">
    <h3>{title}</h3>
    <div class="self-open-profile-grid" use:masonry={entries}>
      {#each entries as entry (entry)}
        {@const name = typeof entry?.name === 'string' && entry.name.trim() ? entry.name : fallbackName}
        {@const description = typeof entry?.description === 'string' ? entry.description : ''}
        {@const tags = Array.isArray(entry?.tags)
          ? entry.tags.filter((tag) => typeof tag === 'string' && tag.trim())
          : []}
        {@const url = typeof entry?.url === 'string' ? entry.url.trim() : ''}
        {@const safeUrl = safeImageUrl(url)}
        {@const created = entryDate(entry?.createdAt)}
        <article class="self-open-profile-card">
          <div class="self-open-profile-main">
            <Avatar url={entry?.[imageKey]} />
            <div class="self-open-profile-heading"><h4 class="self-open-profile-name">{name}</h4></div>
          </div>
          {#if description.trim()}<p class="self-open-profile-description">{description}</p>{/if}
          {#if tags.length}<div class="self-open-profile-tags">
              {#each tags as tag}<span class="self-open-profile-tag">{tag}</span>{/each}
            </div>{/if}
          {#if url}
            <div class="self-open-profile-link-row">
              {#if safeUrl}<a
                  class="self-open-profile-link"
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${name} 링크 열기`}>{url}</a
                >{:else}<span class="self-open-profile-link">{url}</span>{/if}
              <button
                type="button"
                class="self-open-profile-copy"
                aria-label={`${name} 링크 복사`}
                title="링크 복사"
                onclick={(event) => copyLink(event, url)}><CopyIcon /></button
              >
            </div>
          {/if}
          {#if created}<time class="self-open-profile-date" datetime={created.iso}>{created.text}</time>{/if}
        </article>
      {/each}
    </div>
  </section>
{/if}
