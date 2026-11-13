<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  export let member;
  export let kind;
  export let state;
  export let actions;
  export let helpers;
  $: enabled = helpers.hasRole(kind, member);
  $: label = kind === 'admin' ? '관리자' : '밴';
</script>

<button
  type="button"
  class="role-button {kind}"
  class:is-on={enabled}
  aria-label={`${member.name} ${label} ${enabled ? '해제' : '설정'}`}
  aria-pressed={enabled}
  disabled={state.pending.has(`${kind}:${member.id}`)}
  onclick={() => actions.changeRole(member, kind, !enabled)}>{label}</button
>
