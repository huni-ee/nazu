/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import * as LosslessJSON from 'lossless-json';

/** 정밀도를 잃는 큰 정수와 소수는 문자열로, 나머지 숫자는 number로 바꾼다. */
function numberReviver(_key: string, value: unknown): unknown {
  if (!LosslessJSON.isLosslessNumber(value)) return value;

  try {
    const number = value.valueOf();
    return typeof number === 'bigint' ? number.toString() : number;
  } catch {
    return value.toString();
  }
}

function parseLossless<T>(value: string): T {
  return LosslessJSON.parse(value, numberReviver) as T;
}

export const JsonUtil = {
  parseLossless
};
