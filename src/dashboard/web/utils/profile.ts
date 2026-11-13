/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { element, icon } from './dom.js';

export function safeImageUrl(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const parsed = new URL(value, location.href);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
  } catch {
    return '';
  }
}

export function profile(imageUrl: unknown, small = false, fallbackIcon = 'user') {
  const node = element('span', `profile${small ? ' profile-small' : ''}`);
  const fallback = element('span', 'profile-fallback');
  fallback.append(icon(fallbackIcon));
  node.append(fallback);
  const src = safeImageUrl(imageUrl);
  if (src) {
    const img = element('img');
    img.src = src;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => fallback.remove(), { once: true });
    img.addEventListener('error', () => img.remove(), { once: true });
    node.append(img);
  }
  return node;
}
