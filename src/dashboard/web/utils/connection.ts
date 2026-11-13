/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

type ConnectionState = 'checking' | 'connected' | 'disconnected' | 'unavailable';
type ConnectionSnapshot = { state: ConnectionState; checking: boolean; target: string };
type ConnectionStatus = { connected: boolean; connecting?: boolean; target?: string };
type MonitorOptions = {
  requestStatus: (signal: AbortSignal) => Promise<ConnectionStatus>;
  onChange?: (snapshot: ConnectionSnapshot) => void;
  intervalMs?: number;
  timeoutMs?: number;
};
type PendingCheck = { controller: AbortController; cancel: () => void; promise: Promise<ConnectionSnapshot> };

/**
 * 연결 상태를 주기적으로 확인한다. 확인이 겹치지 않고, 멈춘 뒤에는 갱신하지 않는다.
 * 상태나 대상이 바뀌면 onChange를 부르고, 확인 중인지는 snapshot.checking으로 알 수 있다.
 */
export function createConnectionMonitor({
  requestStatus,
  onChange,
  intervalMs = 5000,
  timeoutMs = 5000
}: MonitorOptions) {
  let snapshot: ConnectionSnapshot = { state: 'checking', checking: false, target: '' };
  let active: PendingCheck | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let generation = 0;
  const cancelled = Symbol('cancelled');

  function clearPoll() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function publish(next: ConnectionSnapshot) {
    const changed = snapshot.state !== next.state || snapshot.target !== next.target;
    snapshot = next;
    if (changed) onChange?.({ ...snapshot });
  }

  function refresh() {
    if (active) return active.promise;
    clearPoll();
    snapshot = { ...snapshot, checking: true };
    const currentGeneration = generation;
    const controller = new AbortController();
    let cancel!: () => void;
    let timeout!: ReturnType<typeof setTimeout>;
    const cancellation = new Promise<typeof cancelled>((resolve) => {
      cancel = () => resolve(cancelled);
    });
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error('Connection check timed out.'));
        controller.abort();
      }, timeoutMs);
    });
    const request = Promise.resolve().then<ConnectionStatus | typeof cancelled>(() =>
      generation === currentGeneration ? requestStatus(controller.signal) : cancelled
    );
    const current: PendingCheck = { controller, cancel, promise: Promise.resolve({ ...snapshot }) };
    active = current;
    current.promise = (async () => {
      let next: ConnectionSnapshot;
      try {
        const result = await Promise.race([request, deadline, cancellation]);
        if (generation !== currentGeneration || result === cancelled) return { ...snapshot };
        if (
          typeof result?.connected !== 'boolean' ||
          (result.target !== undefined && typeof result.target !== 'string')
        ) {
          throw new Error('Invalid connection status.');
        }
        next = {
          state: result.connected ? 'connected' : result.connecting ? 'checking' : 'disconnected',
          checking: false,
          target: result.target ?? snapshot.target
        };
      } catch {
        if (generation !== currentGeneration) return { ...snapshot };
        next = { state: 'unavailable', checking: false, target: snapshot.target };
      } finally {
        clearTimeout(timeout);
      }
      if (generation !== currentGeneration) return { ...snapshot };
      publish(next);
      return { ...snapshot };
    })().finally(() => {
      if (active !== current) return;
      active = null;
      if (running) timer = setTimeout(refresh, intervalMs);
    });
    return current.promise;
  }

  return {
    get snapshot() {
      return { ...snapshot };
    },
    refresh,
    start() {
      if (running) return active?.promise ?? Promise.resolve({ ...snapshot });
      running = true;
      return refresh();
    },
    stop() {
      running = false;
      generation += 1;
      clearPoll();
      const pending = active;
      active = null;
      snapshot = { ...snapshot, checking: false };
      pending?.cancel();
      pending?.controller.abort();
    }
  };
}
