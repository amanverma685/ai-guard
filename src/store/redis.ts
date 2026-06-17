import type { GraceSlot, UsageStore, UserState } from "./interface.js";
import {
  createEmptyUserState,
  deductCoinsFromState,
  deserializeUserState,
  recordRequestOnState,
  resetUserState,
  serializeUserState,
  type SerializedUserState,
} from "./state.js";

export type RedisClient = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
};

export type RedisUsageStoreOptions = {
  client: RedisClient;
  keyPrefix?: string;
};

export class RedisUsageStore implements UsageStore {
  private readonly client: RedisClient;
  private readonly keyPrefix: string;

  constructor(options: RedisUsageStoreOptions) {
    this.client = options.client;
    this.keyPrefix = options.keyPrefix ?? "ai-guard:user:";
  }

  private userKey(userId: string): string {
    return `${this.keyPrefix}${userId}`;
  }

  private async loadState(
    userId: string,
    monthlyCoins = 0,
  ): Promise<UserState> {
    const raw = await this.client.get(this.userKey(userId));
    if (!raw) {
      const state = createEmptyUserState(monthlyCoins);
      await this.saveState(userId, state);
      return state;
    }

    const parsed = JSON.parse(raw) as SerializedUserState;
    return deserializeUserState(parsed);
  }

  private async saveState(userId: string, state: UserState): Promise<void> {
    await this.client.set(
      this.userKey(userId),
      JSON.stringify(serializeUserState(state)),
    );
  }

  private async mutateState(
    userId: string,
    mutator: (state: UserState) => void | Promise<void>,
    monthlyCoins = 0,
  ): Promise<UserState> {
    const state = await this.loadState(userId, monthlyCoins);
    await mutator(state);
    await this.saveState(userId, state);
    return state;
  }

  async getUserState(userId: string): Promise<UserState> {
    return this.loadState(userId);
  }

  async initializeUser(userId: string, monthlyCoins: number): Promise<void> {
    const raw = await this.client.get(this.userKey(userId));
    if (!raw) {
      await this.saveState(userId, createEmptyUserState(monthlyCoins));
      return;
    }

    await this.mutateState(userId, (state) => {
      state.monthlyCoins = monthlyCoins;
    });
  }

  async getBalance(userId: string): Promise<number> {
    const state = await this.loadState(userId);
    return state.balance;
  }

  async deductCoins(
    userId: string,
    amount: number,
    allowNegative: boolean,
  ): Promise<number> {
    const state = await this.mutateState(userId, (s) => {
      deductCoinsFromState(s, amount, allowNegative);
    });
    return state.balance;
  }

  async reserveGraceSlot(
    userId: string,
    requestId: string,
    chatId?: string,
  ): Promise<void> {
    const slot: GraceSlot = {
      requestId,
      userId,
      chatId,
      reservedAt: Date.now(),
    };

    await this.mutateState(userId, (state) => {
      state.graceSlots.set(requestId, slot);
    });
  }

  async releaseGraceSlot(userId: string, requestId: string): Promise<void> {
    await this.mutateState(userId, (state) => {
      state.graceSlots.delete(requestId);
    });
  }

  async hasActiveGraceSlot(userId: string): Promise<boolean> {
    const state = await this.loadState(userId);
    return state.graceSlots.size > 0;
  }

  async getChatImageCount(userId: string, chatId: string): Promise<number> {
    const state = await this.loadState(userId);
    return state.chatImageCounts.get(chatId) ?? 0;
  }

  async incrementChatImageCount(
    userId: string,
    chatId: string,
    count: number,
  ): Promise<number> {
    const state = await this.mutateState(userId, (s) => {
      const current = s.chatImageCounts.get(chatId) ?? 0;
      s.chatImageCounts.set(chatId, current + count);
    });
    return state.chatImageCounts.get(chatId) ?? 0;
  }

  async getChatTokenCount(userId: string, chatId: string): Promise<number> {
    const state = await this.loadState(userId);
    return state.chatTokenCounts.get(chatId) ?? 0;
  }

  async incrementChatTokenCount(
    userId: string,
    chatId: string,
    tokens: number,
  ): Promise<number> {
    const state = await this.mutateState(userId, (s) => {
      const current = s.chatTokenCounts.get(chatId) ?? 0;
      s.chatTokenCounts.set(chatId, current + tokens);
    });
    return state.chatTokenCounts.get(chatId) ?? 0;
  }

  async recordRequest(userId: string): Promise<number> {
    let count = 0;
    await this.mutateState(userId, (state) => {
      count = recordRequestOnState(state);
    });
    return count;
  }

  async resetMonthlyUsage(userId: string, monthlyCoins: number): Promise<void> {
    await this.mutateState(userId, (state) => {
      resetUserState(state, monthlyCoins);
    });
  }
}

export function createRedisStore(options: RedisUsageStoreOptions): RedisUsageStore {
  return new RedisUsageStore(options);
}
