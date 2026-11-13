<!--
  Fuwari의 LightDarkSwitch.svelte(MIT, Copyright (c) 2024 saicaca)를 대시보드에 맞게 고쳐 썼다.
  https://github.com/saicaca/fuwari/blob/6d39b0dec41282e7852e23e032998a5789abee28/src/components/LightDarkSwitch.svelte
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { getThemeMode, setThemeMode } from '../../utils/theme.js';

  const LIGHT_MODE = 'light';
  const DARK_MODE = 'dark';
  const AUTO_MODE = 'system';
  type LIGHT_DARK_MODE = typeof LIGHT_MODE | typeof DARK_MODE | typeof AUTO_MODE;

  // 모드 순서와 switchScheme/toggleScheme은 Fuwari 컴포넌트를 따른다.
  const seq: LIGHT_DARK_MODE[] = [LIGHT_MODE, DARK_MODE, AUTO_MODE];
  let mode: LIGHT_DARK_MODE = $state(AUTO_MODE);
  let isOpen = $state(false);
  let iconMarkup = $state({ light: '', dark: '', system: '' });

  onMount(() => {
    mode = getThemeMode();
    iconMarkup = {
      light: document.getElementById('dashboard-icon-theme-light')!.innerHTML,
      dark: document.getElementById('dashboard-icon-theme-dark')!.innerHTML,
      system: document.getElementById('dashboard-icon-theme-system')!.innerHTML
    };
    const update = () => {
      mode = getThemeMode();
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target as Element).closest('.fuwari-mode-control')) hidePanel();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        hidePanel();
        document.getElementById('scheme-switch')?.focus();
      }
    };
    window.addEventListener('arisa-dashboard-themechange', update);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('arisa-dashboard-themechange', update);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  });

  function switchScheme(newMode: LIGHT_DARK_MODE) {
    mode = newMode;
    setThemeMode(newMode);
  }

  function toggleScheme() {
    let i = 0;
    for (; i < seq.length; i++) {
      if (seq[i] === mode) break;
    }
    switchScheme(seq[(i + 1) % seq.length]);
  }

  function showPanel() {
    if (!document.querySelector('.profile-switcher-trigger[aria-expanded="true"]')) isOpen = true;
  }
  function hidePanel() {
    isOpen = false;
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      showPanel();
      requestAnimationFrame(() =>
        document.querySelector<HTMLButtonElement>('#light-dark-panel [aria-checked="true"]')?.focus()
      );
    }
  }
</script>

<div
  class="fuwari-mode-control"
  role="group"
  aria-label="화면 테마"
  onmouseleave={hidePanel}
  onfocusout={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) hidePanel();
  }}
>
  <button
    id="scheme-switch"
    type="button"
    class="sidebar-item fuwari-trigger"
    aria-label="화면 테마: {mode === LIGHT_MODE ? '밝게' : mode === DARK_MODE ? '어둡게' : '시스템'}"
    aria-haspopup="menu"
    aria-controls="light-dark-panel"
    aria-expanded={isOpen}
    onclick={toggleScheme}
    onmouseenter={showPanel}
    onkeydown={keydown}
  >
    {@html iconMarkup[mode]}
  </button>
  <div
    id="light-dark-panel"
    class="fuwari-panel fuwari-mode-panel"
    role="menu"
    aria-label="화면 테마 선택"
    hidden={!isOpen}
  >
    {#each [[LIGHT_MODE, '밝게'], [DARK_MODE, '어둡게'], [AUTO_MODE, '시스템']] as [itemMode, label]}
      <button
        type="button"
        class:current-theme-btn={mode === itemMode}
        role="menuitemradio"
        aria-checked={mode === itemMode}
        onclick={() => switchScheme(itemMode as LIGHT_DARK_MODE)}
      >
        {@html iconMarkup[itemMode as LIGHT_DARK_MODE]}
        {label}
      </button>
    {/each}
  </div>
</div>
