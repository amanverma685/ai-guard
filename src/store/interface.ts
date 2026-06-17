export type GraceSlot = {
  requestId: string;
  userId: string;
  chatId?: string;
  reservedAt: number;
};

export type RateLimitEntry = {
  timestamps: number[];
};

export type UserState = {
  balance: number;
  monthlyCoins: number;
  graceSlots: Map<string, GraceSlot>;
  chatImageCounts: Map<string, number>;
  chatTokenCounts: Map<string, number>;
  rateLimit: RateLimitEntry;
  lastResetAt: number;
};

export interface UsageStore {
  getUserState(userId: string): Promise<UserState>;
  initializeUser(userId: string, monthlyCoins: number): Promise<void>;
  getBalance(userId: string): Promise<number>;
  deductCoins(userId: string, amount: number, allowNegative: boolean): Promise<number>;
  reserveGraceSlot(
    userId: string,
    requestId: string,
    chatId?: string,
  ): Promise<void>;
  releaseGraceSlot(userId: string, requestId: string): Promise<void>;
  hasActiveGraceSlot(userId: string): Promise<boolean>;
  getChatImageCount(userId: string, chatId: string): Promise<number>;
  incrementChatImageCount(
    userId: string,
    chatId: string,
    count: number,
  ): Promise<number>;
  getChatTokenCount(userId: string, chatId: string): Promise<number>;
  incrementChatTokenCount(
    userId: string,
    chatId: string,
    tokens: number,
  ): Promise<number>;
  recordRequest(userId: string): Promise<number>;
  resetMonthlyUsage(userId: string, monthlyCoins: number): Promise<void>;
}
