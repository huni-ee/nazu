/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { Channel } from '../channel/channel.js';
import type { MessageChat } from '../chat/message.js';
import { getDatabase } from '../utils/database/index.js';
import type { User } from '../user/user.js';

type MessageMethod<This, Args extends unknown[] = [], Result extends void | Promise<void> = void | Promise<void>> = (
  this: This,
  chat: MessageChat,
  channel: Channel,
  ...args: Args
) => Result;

type MessageHandler<Args extends unknown[] = [], Result extends void | Promise<void> = void | Promise<void>> = (
  chat: MessageChat,
  channel: Channel,
  ...args: Args
) => Result;

type MessageCheck = (chat: MessageChat, channel: Channel) => boolean | Promise<boolean>;

type MessageDecorator = {
  <This, Args extends unknown[], Result extends void | Promise<void>>(
    listener: MessageMethod<This, Args, Result>,
    context: ClassMethodDecoratorContext<This, MessageMethod<This, Args, Result>>
  ): MessageMethod<This, Args, Result>;
  <Args extends unknown[], Result extends void | Promise<void>>(
    listener: MessageHandler<Args, Result>
  ): MessageHandler<Args, Result>;
};

function decorate(check: MessageCheck): MessageDecorator {
  return function <This, Args extends unknown[], Result extends void | Promise<void>>(
    listener: MessageMethod<This, Args, Result>,
    _context?: ClassMethodDecoratorContext<This, MessageMethod<This, Args, Result>>
  ): MessageMethod<This, Args, Result> {
    return async function (this: This, chat, channel, ...args: Args): Promise<void> {
      if (!(await check(chat, channel))) return;

      await listener.call(this, chat, channel, ...args);
    } as MessageMethod<This, Args, Result>;
  };
}

/**
 * 답장이나 스레드 메세지일 때만 리스너를 실행합니다. 아니면 답장으로 다시 요청하라는 안내를 채팅방에 보냅니다.
 *
 * 메세지 리스너를 감싸거나 클래스 메서드 데코레이터로 씁니다.
 *
 * @example
 * ```ts
 * client.on('message', isReply(async (chat, channel) => {
 *   const source = await chat.getSource();
 *   await channel.send(source.text);
 * }));
 * ```
 */
export const isReply = decorate(async (chat, channel) => {
  if (chat.isReply()) return true;

  await channel.send('메세지에 답장하여 요청하세요.');
  return false;
});

/** 메세지의 앞뒤 공백을 빼고 공백으로 나눴을 때 단어가 두 개 이상이면 리스너를 실행합니다. */
export const hasParam = decorate((chat) => chat.text.trim().split(/\s+/).length > 1);

/** 보낸 유저가 관리자 목록에 있을 때만 리스너를 실행합니다. 관리자는 대시보드에서 추가합니다. */
export const isAdmin = decorate((chat) => adminCheck(chat.user));

/** 보낸 유저가 차단 목록에 없을 때만 리스너를 실행합니다. 유저 정보가 없거나 데이터베이스가 준비되지 않았어도 실행합니다. */
export const isNotBanned = decorate((chat) => !banCheck(chat.user));

/**
 * 유저가 관리자 목록에 있으면 `true`입니다.
 *
 * 관리자와 차단 목록은 실행 폴더의 `data/arisa.db`에 저장됩니다. 유저가 `null`이거나 데이터베이스가 아직 준비되지 않았으면 `false`를 돌려줍니다.
 */
export function adminCheck(user: User | null): boolean {
  if (user === null) return false;

  const database = getDatabase();
  if (database === null) return false;
  const admin = database.prepare<[string]>('SELECT 1 FROM admin WHERE user_id = ?').get(user.id);

  if (admin !== undefined) return true;

  const hasAdmin = database.prepare('SELECT 1 FROM admin LIMIT 1').get() !== undefined;
  if (!hasAdmin) {
    console.log('관리자 목록이 비어있는 상태에서 admin 체크가 실행되고 있습니다.');
  }

  return false;
}

/**
 * 유저가 차단 목록에 있으면 `true`입니다.
 *
 * 관리자와 차단 목록은 실행 폴더의 `data/arisa.db`에 저장됩니다. 유저가 `null`이거나 데이터베이스가 아직 준비되지 않았으면 `false`를 돌려줍니다.
 */
export function banCheck(user: User | null): boolean {
  if (user === null) return false;

  const database = getDatabase();
  if (database === null) return false;

  const banned = database.prepare<[string]>('SELECT 1 FROM ban WHERE user_id = ?').get(user.id);

  return banned !== undefined;
}

/** 유저를 차단 목록에 추가합니다. 새로 추가했으면 `true`, 이미 있었으면 `false`입니다. */
export function addBan(user: User | null): boolean {
  if (user === null) return false;

  const database = getDatabase();
  if (database === null) return false;

  const result = database.prepare<[string]>('INSERT OR IGNORE INTO ban (user_id) VALUES (?)').run(user.id);
  return result.changes > 0;
}

/** 유저를 차단 목록에서 뺍니다. 뺐으면 `true`, 목록에 없었으면 `false`입니다. */
export function removeBan(user: User | null): boolean {
  if (user === null) return false;

  const database = getDatabase();
  if (database === null) return false;

  const result = database.prepare<[string]>('DELETE FROM ban WHERE user_id = ?').run(user.id);
  return result.changes > 0;
}
