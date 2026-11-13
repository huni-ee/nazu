/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { ui } from './ui.js';

let toastTimeout: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string, isError = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle('is-error', isError);
  ui.toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    ui.toast.hidden = true;
  }, 3800);
}
