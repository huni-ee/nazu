/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { OpenProfileRow, Store } from '../grpc/store.js';
import type { OpenProfileChangeUser } from '../types/event.js';

type ProfileChange = (
  beforeUser: OpenProfileChangeUser,
  afterUser: OpenProfileChangeUser,
  channelId: string
) => Promise<void>;

type ProfileError = (error: unknown) => Promise<void>;

/** 오픈프로필 감시 */
export class OpenProfileWatcher {
  private profiles = new Map<string, OpenProfileRow>();
  private timer: NodeJS.Timeout | undefined;
  private watching = false;
  private runId = 0;

  constructor(
    private readonly store: Store,
    private readonly onChange: ProfileChange,
    private readonly onError: ProfileError,
    private readonly interval = 1500
  ) {}

  /** 프로필 확인을 시작한다. */
  start(): void {
    if (this.watching) return;
    this.watching = true;
    void this.watch(++this.runId);
  }

  /** 프로필 확인을 멈춘다. */
  stop(): void {
    this.watching = false;
    this.runId += 1;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.profiles.clear();
  }

  private async check(runId: number): Promise<void> {
    const rows = await this.store.getOpenProfiles();
    const current = new Map<string, OpenProfileRow>();

    for (const row of rows) {
      current.set(profileKey(row), row);
    }

    if (!this.isCurrent(runId)) return;

    for (const [key, after] of current) {
      const before = this.profiles.get(key);
      if (before !== undefined && isProfileChanged(before, after)) {
        const [beforeUser, afterUser] = await Promise.all([
          this.store.readOpenProfile(before),
          this.store.readOpenProfile(after)
        ]);
        if (!this.isCurrent(runId)) return;
        await this.onChange(beforeUser, afterUser, after.channelId);
      }
    }

    if (this.isCurrent(runId)) this.profiles = current;
  }

  private async watch(runId: number): Promise<void> {
    if (!this.isCurrent(runId)) return;

    try {
      await this.check(runId);
    } catch (error) {
      if (this.isCurrent(runId)) await this.onError(error);
    }

    if (this.isCurrent(runId)) {
      this.timer = setTimeout(() => void this.watch(runId), this.interval);
    }
  }

  private isCurrent(runId: number): boolean {
    return this.watching && this.runId === runId;
  }
}

function profileKey(profile: OpenProfileRow): string {
  return `${profile.channelId}:${profile.userId}`;
}

function isProfileChanged(before: OpenProfileRow, after: OpenProfileRow): boolean {
  return before.rawName !== after.rawName || before.rawImage !== after.rawImage;
}
