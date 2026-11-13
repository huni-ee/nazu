<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Loading from './friends/Loading.svelte';

  export let person;
  export let state;
  export let hasRole;
  export let onChange;
  export let onRetry;
</script>

<section class="friend-detail-basics friend-detail-permissions">
  <div class="friend-detail-permission-header"><h3>봇 권한</h3></div>
  {#if !/^[1-9]\d*$/.test(person.id)}
    <p class="friend-detail-extra-state">유저 ID가 없어 권한을 설정할 수 없습니다.</p>
  {:else if !state.rolesLoaded}
    {#if state.rolesError}
      <p class="friend-detail-extra-state">{state.rolesError}</p>
      <button type="button" class="button-secondary" onclick={onRetry}>다시 시도</button>
    {:else}
      <Loading message="권한 정보를 불러오는 중…" />
    {/if}
  {:else}
    <div class="friend-detail-permission-card">
      {#each ['admin', 'ban'] as kind}
        {@const on = hasRole(kind, person)}
        {@const pending = state.pending.has(`${kind}:${person.id}`)}
        {@const label = kind === 'admin' ? '관리자' : '밴'}
        <div class="friend-role-row">
          <div class="friend-role-info">
            <span class="friend-role-name">{label}</span>
            <p class="friend-role-description">{kind === 'admin' ? '봇 관리자' : '봇 명령 사용 제한'}</p>
          </div>
          <div class="friend-role-control">
            <span class="friend-role-state" aria-live="polite">{on ? '켬' : '끔'}</span>
            <button
              type="button"
              class="friend-role-switch {kind}"
              class:is-on={on}
              role="switch"
              aria-label={`${person.name} ${label} 권한`}
              aria-checked={String(on)}
              aria-busy={String(pending)}
              disabled={pending}
              onclick={() => onChange(person, kind, !on)}
              ><span class="friend-role-switch-track" aria-hidden="true"></span></button
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
