/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

const nameCollator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
const emojiStart = /^(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|[#*0-9]\uFE0F?\u20E3)/u;

function nameGroup(name: string) {
  if (!name) return 5;
  if (emojiStart.test(name)) return 4;
  const first = String.fromCodePoint(name.codePointAt(0)!);
  if (/\p{Script=Hangul}/u.test(first)) return 0;
  if (/\p{Script=Latin}/u.test(first)) return 1;
  if (/\p{Decimal_Number}/u.test(first)) return 2;
  return 3;
}

export function compareNames(left: string, right: string) {
  const leftName = left.trim();
  const rightName = right.trim();
  return nameGroup(leftName) - nameGroup(rightName) || nameCollator.compare(leftName, rightName);
}
