import type { GraceSlot, RateLimitEntry, UserState } from "./interface.js";

export const RATE_LIMIT_WINDOW_MS = 60_000;

export type SerializedUserState = {
  balance: number;
  monthlyCoins: number;
  graceSlots: Record<string, GraceSlot>;
  chatImageCounts: Record<string, number>;
  chatTokenCounts: Record<string, number>;
  rateLimit: RateLimitEntry;
  lastResetAt: number;
};

export function createEmptyUserState(monthlyCoins: number): UserState {
  return {
    balance: monthlyCoins,
    monthlyCoins,
    graceSlots: new Map(),
    chatImageCounts: new Map(),
    chatTokenCounts: new Map(),
    rateLimit: { timestamps: [] },
    lastResetAt: Date.now(),
  };
}

export function serializeUserState(state: UserState): SerializedUserState {
  return {
    balance: state.balance,
    monthlyCoins: state.monthlyCoins,
    graceSlots: Object.fromEntries(state.graceSlots),
    chatImageCounts: Object.fromEntries(state.chatImageCounts),
    chatTokenCounts: Object.fromEntries(state.chatTokenCounts),
    rateLimit: state.rateLimit,
    lastResetAt: state.lastResetAt,
  };
}

export function deserializeUserState(data: SerializedUserState): UserState {
  return {
    balance: data.balance,
    monthlyCoins: data.monthlyCoins,
    graceSlots: new Map(Object.entries(data.graceSlots)),
    chatImageCounts: new Map(Object.entries(data.chatImageCounts)),
    chatTokenCounts: new Map(Object.entries(data.chatTokenCounts)),
    rateLimit: data.rateLimit,
    lastResetAt: data.lastResetAt,
  };
}

export function deductCoinsFromState(
  state: UserState,
  amount: number,
  allowNegative: boolean,
): number {
  const next = state.balance - amount;
  if (!allowNegative && next < 0) {
    state.balance = 0;
  } else {
    state.balance = next;
  }
  return state.balance;
}

export function recordRequestOnState(state: UserState): number {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  state.rateLimit.timestamps = state.rateLimit.timestamps.filter(
    (t) => t > windowStart,
  );
  state.rateLimit.timestamps.push(now);
  return state.rateLimit.timestamps.length;
}

export function resetUserState(state: UserState, monthlyCoins: number): void {
  state.balance = monthlyCoins;
  state.monthlyCoins = monthlyCoins;
  state.chatImageCounts.clear();
  state.chatTokenCounts.clear();
  state.rateLimit.timestamps = [];
  state.graceSlots.clear();
  state.lastResetAt = Date.now();
}
