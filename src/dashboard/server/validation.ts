/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/** 경로나 DB에 그대로 써도 되는 ID인지 확인한다. 숫자가 아닌 ID도 허용한다. */
export function isSafeId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    value.trim() === value &&
    !hasControlCharacter(value) &&
    !value.includes('/') &&
    !value.includes('\\')
  );
}

/** 화면에 표시하거나 레이블로 저장할 수 있는 이름인지 확인한다. */
export function isSafeName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 256 && !hasControlCharacter(value);
}

/** http·https 주소만 프로필 이미지로 사용한다. */
export function profileImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
