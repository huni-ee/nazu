/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type {
  DeleteListener,
  EditListener,
  ErrorContext,
  ErrorListener,
  FeedListener,
  HideListener,
  InviteListener,
  JoinListener,
  KickListener,
  LeaveListener,
  MemberTypeChangeListener,
  MessageListener,
  OpenProfileChangeListener
} from '../types/event.js';

/** 클라이언트 이벤트 */
export interface ClientListenerMap {
  readonly message: MessageListener;
  readonly error: ErrorListener;
  readonly feed: FeedListener;
  readonly delete: DeleteListener;
  readonly edit: EditListener;
  readonly hide: HideListener;
  readonly join: JoinListener;
  readonly invite: InviteListener;
  readonly leave: LeaveListener;
  readonly kick: KickListener;
  readonly member_type_change: MemberTypeChangeListener;
  readonly open_profile_change: OpenProfileChangeListener;
}

type ListenerName = keyof ClientListenerMap;
type ListenerArgs<Name extends ListenerName> = Parameters<ClientListenerMap[Name]>;
type ListenerLists = { [Name in ListenerName]: ClientListenerMap[Name][] };

export class Listeners {
  private readonly listeners: ListenerLists = {
    message: [],
    error: [],
    feed: [],
    delete: [],
    edit: [],
    hide: [],
    join: [],
    invite: [],
    leave: [],
    kick: [],
    member_type_change: [],
    open_profile_change: []
  };

  /** 이벤트 리스너를 등록한다. */
  on<Name extends ListenerName>(event: Name, listener: ClientListenerMap[Name]): void {
    this.list(event).push(listener);
  }

  /** 이벤트 리스너 등록을 해제한다. */
  off<Name extends ListenerName>(event: Name, listener: ClientListenerMap[Name]): void {
    const listeners = this.list(event);
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  }

  /** 등록된 리스너가 있는지 확인한다. */
  has(event: ListenerName): boolean {
    return this.listeners[event].length !== 0;
  }

  /** 이벤트를 등록된 리스너에 전달한다. */
  async emit<Name extends ListenerName>(event: Name, ...args: ListenerArgs<Name>): Promise<void> {
    for (const listener of this.list(event)) {
      try {
        const call = listener as (...values: ListenerArgs<Name>) => void | Promise<void>;
        await call(...args);
      } catch (exception) {
        await this.emitError(event, listener, exception, args);
      }
    }
  }

  /** 리스너에서 발생한 오류를 오류 이벤트로 전달한다. */
  async emitError(event: string, func: unknown, exception: unknown, args: readonly unknown[]): Promise<void> {
    if (event === 'error' || !this.has('error')) {
      console.error(exception);
      return;
    }

    const context: ErrorContext = { event, func, exception, args };
    for (const listener of this.listeners.error) {
      try {
        await listener(context);
      } catch (error) {
        console.error(error);
      }
    }
  }

  private list<Name extends ListenerName>(event: Name): ListenerLists[Name] {
    return this.listeners[event];
  }
}
