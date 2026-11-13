/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { flushSync, mount, unmount } from 'svelte';
import LightDarkSwitch from '../components/fuwari/LightDarkSwitch.svelte';
import ThemePreview from '../components/ThemePreview.svelte';
import { button, element, icon } from './dom.js';
import { getDefaultHue, getHue, getThemeMode, setHue } from './theme.js';

export function createThemeSettings() {
  const node = element('div', 'settings-content theme-settings-content');
  const header = element('header', 'settings-page-header');
  header.append(element('h1', '', '설정'), element('p', '', '화면 모드와 테마 색상을 조절하세요.'));
  const panel = element('div', 'theme-settings-panel');
  const preview = element('div', 'theme-preview-host');
  const controls = element('div', 'theme-settings-controls');
  panel.append(preview, controls);
  node.append(header, panel);
  const modeRow = element('section', 'theme-setting-row theme-mode-row');
  const modeCopy = element('div', 'theme-setting-copy');
  const modeHeading = element('h2', '', '화면 모드');
  const modeHint = element('p');
  modeCopy.append(modeHeading, modeHint);
  modeHeading.id = 'theme-settings-title';
  modeRow.setAttribute('aria-labelledby', modeHeading.id);
  const modeControl = element('div', 'theme-control mode-control');
  const modeValue = element('span', 'theme-setting-value');
  const modeMount = element('div');
  modeControl.append(modeValue, modeMount);
  let modeComponent!: Record<string, unknown>;
  let previewComponent!: Record<string, unknown>;
  flushSync(() => {
    modeComponent = mount(LightDarkSwitch, { target: modeMount });
    previewComponent = mount(ThemePreview, { target: preview });
  });
  modeRow.append(modeCopy, modeControl);
  controls.append(modeRow);

  type Popover = { control: HTMLDivElement; trigger: HTMLButtonElement; panel: HTMLElement };
  let activePopover: Popover | null = null;
  let hueSlider: HTMLInputElement | undefined;
  let hueValue: HTMLOutputElement | undefined;
  let resetHue: HTMLButtonElement | undefined;
  let colorControl: HTMLDivElement | undefined;
  let colorPopover: Popover | undefined;

  if (document.documentElement.dataset.themeColorFixed !== 'true') {
    const colorRow = element('section', 'theme-setting-row');
    const colorCopy = element('div', 'theme-setting-copy');
    const colorRowHeading = element('h2', '', '테마 색상');
    colorCopy.append(colorRowHeading, element('p', '', '버튼과 선택 항목에 적용됩니다.'));
    colorRowHeading.id = 'theme-color-row-title';
    colorRow.setAttribute('aria-labelledby', colorRowHeading.id);
    colorControl = element('div', 'theme-control color-control');
    const colorToggle = button('theme-toggle theme-color-toggle', '', (event) =>
      togglePanel(colorPopover!, event.detail === 0)
    );
    colorToggle.id = 'theme-color-toggle';
    const colorSwatch = element('span', 'theme-accent-swatch');
    colorSwatch.setAttribute('aria-hidden', 'true');
    colorToggle.append(colorSwatch, icon('theme-color'));
    colorToggle.setAttribute('aria-label', '테마 색상 변경');
    colorToggle.setAttribute('aria-haspopup', 'dialog');
    colorToggle.setAttribute('aria-expanded', 'false');
    colorToggle.setAttribute('aria-controls', 'theme-color-panel');
    const colorPanel = element('section', 'theme-popover theme-color-panel');
    colorPanel.id = 'theme-color-panel';
    colorPanel.hidden = true;
    colorPanel.setAttribute('role', 'dialog');
    colorPanel.setAttribute('aria-labelledby', 'theme-color-settings-title');
    const colorHeader = element('div', 'theme-color-header');
    const colorHeading = element('h3', '', '테마 색상');
    colorHeading.id = 'theme-color-settings-title';
    resetHue = button('theme-color-reset', '', () => {
      hueSlider!.focus();
      setHue(getDefaultHue());
    });
    resetHue.append(icon('theme-reset'));
    resetHue.setAttribute('aria-label', '테마 색상을 기본값으로 복원');
    resetHue.title = '테마 색상을 기본값으로 복원';
    hueValue = element('output', 'theme-color-value');
    hueValue.setAttribute('for', 'theme-color-slider');
    hueSlider = element('input', 'theme-color-slider');
    hueSlider.id = 'theme-color-slider';
    hueSlider.type = 'range';
    hueSlider.min = '0';
    hueSlider.max = '360';
    hueSlider.step = '5';
    hueSlider.setAttribute('aria-labelledby', colorHeading.id);
    hueSlider.addEventListener('input', () => setHue(Number(hueSlider!.value)));
    const colorTrack = element('div', 'theme-color-track');
    colorTrack.append(hueSlider);
    colorHeader.append(colorHeading, resetHue, hueValue);
    colorPanel.append(colorHeader, colorTrack);
    colorControl.append(colorToggle, colorPanel);
    colorRow.append(colorCopy, colorControl);
    controls.append(colorRow);
    colorPopover = { control: colorControl, trigger: colorToggle, panel: colorPanel };
  }

  function closePanel(restoreFocus = false) {
    if (!activePopover) return;
    const previous = activePopover;
    activePopover = null;
    previous.panel.hidden = true;
    previous.trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) previous.trigger.focus();
  }

  function openPanel(popover: Popover, focus = false) {
    if (activePopover !== popover) closePanel();
    activePopover = popover;
    popover.panel.hidden = false;
    popover.trigger.setAttribute('aria-expanded', 'true');
    if (focus) hueSlider!.focus();
  }

  function togglePanel(popover: Popover, focus = false) {
    if (activePopover === popover) closePanel();
    else openPanel(popover, focus);
  }

  const onFocusOut = (event: FocusEvent) => {
    if (activePopover && !activePopover.control.contains(event.relatedTarget as Node | null)) closePanel();
  };
  const onOutsidePointerDown = (event: PointerEvent) => {
    if (activePopover && !activePopover.control.contains(event.target as Node | null)) closePanel();
  };
  const onEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !activePopover) return;
    event.preventDefault();
    closePanel(true);
  };

  const updateThemeSettings = () => {
    const mode = getThemeMode();
    modeValue.textContent = { light: '밝게', dark: '어둡게', system: '시스템' }[mode];
    modeHint.textContent = {
      light: '밝은 화면으로 표시합니다.',
      dark: '어두운 화면으로 표시합니다.',
      system: '기기의 화면 모드를 따릅니다.'
    }[mode];
    if (hueSlider) {
      const hue = getHue();
      const isDefault = hue === getDefaultHue();
      hueSlider.value = String(hue);
      hueSlider.setAttribute('aria-valuetext', String(hue) + '°');
      hueValue!.value = String(hue);
      resetHue!.disabled = isDefault;
      resetHue!.tabIndex = isDefault ? -1 : 0;
      resetHue!.classList.toggle('is-default', isDefault);
    }
  };
  updateThemeSettings();
  const onModeEnter = () => closePanel();
  modeControl.addEventListener('pointerenter', onModeEnter);
  modeControl.addEventListener('focusin', onModeEnter);
  colorControl?.addEventListener('focusout', onFocusOut);
  document.addEventListener('pointerdown', onOutsidePointerDown);
  document.addEventListener('keydown', onEscape);
  window.addEventListener('arisa-dashboard-themechange', updateThemeSettings);

  return {
    node,
    cleanup: () => {
      flushSync(() => void unmount(modeComponent));
      flushSync(() => void unmount(previewComponent));
      closePanel();
      modeControl.removeEventListener('pointerenter', onModeEnter);
      modeControl.removeEventListener('focusin', onModeEnter);
      colorControl?.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onOutsidePointerDown);
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('arisa-dashboard-themechange', updateThemeSettings);
    }
  };
}
