/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

(() => {
  const root = document.documentElement;
  const normalizeHue = (value: unknown, fallback: number) => {
    if (value == null || String(value).trim() === '') return fallback;
    const hue = Number(value);
    return Number.isFinite(hue) && hue >= 0 && hue <= 360 ? hue : fallback;
  };
  const defaultHue = normalizeHue(root.dataset.defaultHue, 250);
  let mode = 'system';
  let hue = defaultHue;
  try {
    const savedMode = localStorage.getItem('arisa-dashboard-theme');
    if (savedMode === 'system' || savedMode === 'light' || savedMode === 'dark') mode = savedMode;
    hue = normalizeHue(localStorage.getItem('arisa-dashboard-hue'), defaultHue);
  } catch {
    // 저장소를 못 쓰면 시스템 테마와 기본 색상을 쓴다.
  }
  root.dataset.hue = String(hue);
  root.style.setProperty('--hue', String(hue));
  root.dataset.themeMode = mode;
  root.dataset.theme =
    mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
})();
