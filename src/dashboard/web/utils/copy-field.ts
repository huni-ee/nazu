/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

const copyResetTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

export async function copyText(copyButton: HTMLButtonElement, value: string) {
  clearTimeout(copyResetTimers.get(copyButton));
  copyResetTimers.delete(copyButton);
  copyButton.disabled = true;
  copyButton.setAttribute('aria-busy', 'true');
  copyButton.classList.add('copy-feedback', 'is-copying');

  try {
    await navigator.clipboard.writeText(value);
    copyButton.classList.add('is-copied');
    copyResetTimers.set(
      copyButton,
      setTimeout(() => {
        copyButton.classList.remove('is-copied');
        copyResetTimers.delete(copyButton);
      }, 1700)
    );
  } catch (error) {
    copyButton.classList.remove('is-copied');
    throw error;
  } finally {
    copyButton.disabled = false;
    copyButton.removeAttribute('aria-busy');
    copyButton.classList.remove('is-copying');
  }
}
