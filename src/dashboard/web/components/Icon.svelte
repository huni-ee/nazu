<script>
  /*
   * Created on Fri Nov 13 2026
   *
   * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
   */

  import icons from 'virtual:dashboard-icons';

  let { name, className = '' } = $props();
  const escapeAttribute = (value) =>
    value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  let markup = $derived(
    className ? icons[name].replace('class="', `class="${escapeAttribute(className)} `) : icons[name]
  );
</script>

{@html markup}
