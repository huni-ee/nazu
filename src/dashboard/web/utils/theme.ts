/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

const storageKey = 'arisa-dashboard-theme';
const hueStorageKey = 'arisa-dashboard-hue';
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const root = document.documentElement;
type ThemeMode = 'system' | 'light' | 'dark';
const normalizeMode = (value: unknown): ThemeMode => (value === 'light' || value === 'dark' ? value : 'system');
const normalizeHue = (value: unknown) => {
  if (value == null || String(value).trim() === '') return getDefaultHue();
  const hue = Number(value);
  return Number.isFinite(hue) && hue >= 0 && hue <= 360 ? hue : getDefaultHue();
};
let mode = normalizeMode(root.dataset.themeMode);
let hue = normalizeHue(root.dataset.hue);

function applyTheme() {
  const theme = mode === 'system' ? (systemTheme.matches ? 'dark' : 'light') : mode;
  if (root.dataset.theme !== theme || root.dataset.hue !== String(hue)) {
    root.classList.add('theme-changing');
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-changing')));
  }
  root.dataset.themeMode = mode;
  root.dataset.theme = theme;
  root.dataset.hue = String(hue);
  root.style.setProperty('--hue', String(hue));
  window.dispatchEvent(new window.Event('arisa-dashboard-themechange'));
}

export function getThemeMode() {
  return mode;
}

export function setThemeMode(value: ThemeMode) {
  mode = normalizeMode(value);
  applyTheme();
  try {
    localStorage.setItem(storageKey, mode);
  } catch {
    // 저장소를 못 써도 현재 화면에는 적용한다.
  }
}

export function getDefaultHue() {
  const value = root.dataset.defaultHue;
  if (value == null || String(value).trim() === '') return 250;
  const hue = Number(value);
  return Number.isFinite(hue) && hue >= 0 && hue <= 360 ? hue : 250;
}

export function getHue() {
  return hue;
}

export function setHue(value: number) {
  hue = normalizeHue(value);
  applyTheme();
  try {
    localStorage.setItem(hueStorageKey, String(hue));
  } catch {
    // 저장소를 못 써도 현재 화면에는 적용한다.
  }
}

systemTheme.addEventListener('change', () => {
  if (mode === 'system') applyTheme();
});

window.addEventListener('storage', (event) => {
  if (event.key === storageKey) mode = normalizeMode(event.newValue);
  else if (event.key === hueStorageKey) hue = normalizeHue(event.newValue);
  else if (event.key === null) {
    mode = 'system';
    hue = getDefaultHue();
    try {
      mode = normalizeMode(localStorage.getItem(storageKey));
      hue = normalizeHue(localStorage.getItem(hueStorageKey));
    } catch {
      // 저장소를 못 쓰면 시스템 테마와 기본 색상을 쓴다.
    }
  } else return;
  applyTheme();
});

applyTheme();
