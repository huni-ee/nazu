<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import Icon from '../Icon.svelte';
  export let message;
</script>

<div class="loading-state" role="status" aria-atomic="true">
  <Icon name="refresh" className="loading-state-spinner" />
  <span class="loading-state-label">{message}</span>
</div>
