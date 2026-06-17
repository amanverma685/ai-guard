import type { UsageStore, UserState } from "./interface.js";
import {
  createEmptyUserState,
  deductCoinsFromState,
  recordRequestOnState,
  resetUserState,
} from "./state.js";

export class MemoryUsageStore implements UsageStore {
  private readonly users = new Map<string, UserState>();

  private getOrCreate(userId: string, monthlyCoins = 0): UserState {
    let state = this.users.get(userId);
    if (!state) {
      state = createEmptyUserState(monthlyCoins);
      this.users.set(userId, state);
    }
    return state;
  }

  async getUserState(userId: string): Promise<UserState> {
    return this.getOrCreate(userId);
  }

  async initializeUser(userId: string, monthlyCoins: number): Promise<void> {
    const existing = this.users.get(userId);
    if (!existing) {
      this.users.set(userId, createEmptyUserState(monthlyCoins));
      return;
    }
    existing.monthlyCoins = monthlyCoins;
  }

  async getBalance(userId: string): Promise<number> {
    return this.getOrCreate(userId).balance;
  }

  async deductCoins(
    userId: string,
    amount: number,
    allowNegative: boolean,
  ): Promise<number> {
    const state = this.getOrCreate(userId);
    return deductCoinsFromState(state, amount, allowNegative);
  }

  async reserveGraceSlot(
    userId: string,
    requestId: string,
    chatId?: string,
  ): Promise<void> {
    const state = this.getOrCreate(userId);
    state.graceSlots.set(requestId, {
      requestId,
      userId,
      chatId,
      reservedAt: Date.now(),
    });
  }

  async releaseGraceSlot(userId: string, requestId: string): Promise<void> {
    this.getOrCreate(userId).graceSlots.delete(requestId);
  }

  async hasActiveGraceSlot(userId: string): Promise<boolean> {
    return this.getOrCreate(userId).graceSlots.size > 0;
  }

  async getChatImageCount(userId: string, chatId: string): Promise<number> {
    return this.getOrCreate(userId).chatImageCounts.get(chatId) ?? 0;
  }

  async incrementChatImageCount(
    userId: string,
    chatId: string,
    count: number,
  ): Promise<number> {
    const state = this.getOrCreate(userId);
    const current = state.chatImageCounts.get(chatId) ?? 0;
    const next = current + count;
    state.chatImageCounts.set(chatId, next);
    return next;
  }

  async getChatTokenCount(userId: string, chatId: string): Promise<number> {
    return this.getOrCreate(userId).chatTokenCounts.get(chatId) ?? 0;
  }

  async incrementChatTokenCount(
    userId: string,
    chatId: string,
    tokens: number,
  ): Promise<number> {
    const state = this.getOrCreate(userId);
    const current = state.chatTokenCounts.get(chatId) ?? 0;
    const next = current + tokens;
    state.chatTokenCounts.set(chatId, next);
    return next;
  }

  async recordRequest(userId: string): Promise<number> {
    return recordRequestOnState(this.getOrCreate(userId));
  }

  async resetMonthlyUsage(userId: string, monthlyCoins: number): Promise<void> {
    resetUserState(this.getOrCreate(userId), monthlyCoins);
  }
}

export function createMemoryStore(): MemoryUsageStore {
  return new MemoryUsageStore();
}
