/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import { HttpError } from './http.js';

interface SqlToken {
  readonly text: string;
  readonly kind: 'word' | 'identifier' | 'literal' | 'symbol' | 'parameter';
}

const writeKeywords = new Set([
  'INSERT',
  'UPDATE',
  'DELETE',
  'REPLACE',
  'DROP',
  'CREATE',
  'ALTER',
  'ATTACH',
  'DETACH',
  'VACUUM',
  'PRAGMA',
  'REINDEX',
  'ANALYZE',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'SAVEPOINT',
  'RELEASE',
  'TRANSACTION'
]);
const externalFunctions = new Set([
  'LOAD_EXTENSION',
  'EVAL',
  'READFILE',
  'WRITEFILE',
  'SQLCIPHER_EXPORT',
  'SQLCIPHER_PERF_SETUP',
  'SQLCIPHER_PERF_TEST'
]);

function invalidSql(): never {
  throw new HttpError(400, 'SELECT 또는 WITH로 시작하는 조회 SQL 한 개만 실행할 수 있습니다.');
}

/** 문자열·식별자·주석을 구분해 SQLite 문장 경계와 변경 명령을 확인한다. */
function sqlTokens(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let index = 0;
  let ended = false;
  while (index < sql.length) {
    const character = sql[index] ?? '';
    const next = sql[index + 1];
    if (/\s/.test(character)) {
      index++;
      continue;
    }
    if (character === '-' && next === '-') {
      index = sql.indexOf('\n', index + 2);
      if (index === -1) break;
      continue;
    }
    if (character === '/' && next === '*') {
      const closing = sql.indexOf('*/', index + 2);
      if (closing === -1) invalidSql();
      index = closing + 2;
      continue;
    }
    if (ended) invalidSql();
    if (character === ';') {
      ended = true;
      index++;
      continue;
    }
    if (character === "'" || character === '"' || character === '`' || character === '[') {
      const closing = character === '[' ? ']' : character;
      let value = '';
      let closed = false;
      index++;
      while (index < sql.length) {
        const current = sql[index] ?? '';
        if (current === closing) {
          if (closing !== ']' && sql[index + 1] === closing) {
            value += closing;
            index += 2;
            continue;
          }
          index++;
          closed = true;
          break;
        }
        value += current;
        index++;
      }
      if (!closed) invalidSql();
      tokens.push({ text: value.toUpperCase(), kind: character === "'" ? 'literal' : 'identifier' });
      continue;
    }
    if (character === '?' || character === ':' || character === '@' || character === '$') {
      let value = character;
      index++;
      while (index < sql.length && /[\p{L}\p{N}_$]/u.test(sql[index] ?? '')) value += sql[index++];
      tokens.push({ text: value, kind: 'parameter' });
      continue;
    }
    if (/[\p{L}\p{N}_]/u.test(character)) {
      let value = character;
      index++;
      while (index < sql.length && /[\p{L}\p{N}_$]/u.test(sql[index] ?? '')) value += sql[index++];
      tokens.push({ text: value.toUpperCase(), kind: 'word' });
      continue;
    }
    tokens.push({ text: character, kind: 'symbol' });
    index++;
  }
  return tokens;
}

/** 홈에서는 Arisa의 RawQuery를 조회 용도로만 사용한다. */
export function validateHomeSql(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 3000 || value.includes('\0')) {
    throw new HttpError(400, 'SQL을 1~3000자로 입력해 주세요.');
  }
  const sql = value.trim();
  const tokens = sqlTokens(sql);
  const first = tokens[0];
  if (first?.kind !== 'word' || (first.text !== 'SELECT' && first.text !== 'WITH')) invalidSql();
  for (const [index, token] of tokens.entries()) {
    const functionCall = tokens[index + 1]?.text === '(';
    if ((token.kind === 'word' || token.kind === 'identifier') && externalFunctions.has(token.text)) {
      if (functionCall) throw new HttpError(400, '파일·확장 기능을 실행하는 SQL은 사용할 수 없습니다.');
    }
    if (token.kind === 'word' && writeKeywords.has(token.text)) {
      // SQLite의 문자열 REPLACE() 함수는 데이터 변경 명령과 구분한다.
      if (token.text !== 'REPLACE' || !functionCall) invalidSql();
    }
  }
  return sql;
}
