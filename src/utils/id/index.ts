/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

const maxLong = 9223372036854775807n;

/** 양의 64비트 정수 문자열인지 확인한다. 카카오톡의 유저·채팅방·메세지 ID가 이 형식이다. */
export function isLongId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= maxLong;
}
