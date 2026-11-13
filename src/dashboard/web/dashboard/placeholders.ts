/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { button, element, icon } from '../utils/dom.js';

export function errorMessage(message: string, retry: () => void | Promise<void>) {
  const box = element('div', 'error-message', message);
  box.append(
    button('', '다시 시도', () => {
      void retry();
    })
  );
  return box;
}

export function emptyState(title: string, description: string, retry?: () => void | Promise<void>) {
  const box = element('div', 'empty-state');
  box.append(element('h3', '', title), element('p', '', description));
  if (retry)
    box.append(
      button('button-primary', '다시 시도', () => {
        void retry();
      })
    );
  return box;
}

export function loadingState(message: string, fullPage = false) {
  const box = element('div', `loading-state${fullPage ? ' is-page' : ''}`);
  box.setAttribute('role', 'status');
  box.setAttribute('aria-atomic', 'true');
  const spinner = icon('refresh');
  spinner.classList.add('loading-state-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  box.append(spinner, element('span', 'loading-state-label', message));
  return box;
}

export function loadingListItem(message: string) {
  const item = element('li', 'channel-loading');
  item.append(loadingState(message));
  return item;
}
