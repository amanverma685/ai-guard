import { afterRequest } from "./after-request.js";
import { beforeRequest } from "./before-request.js";
import { parsePlan } from "../config/schemas.js";
import { getDomainProfile } from "../domain/registry.js";
import type { DomainProfile } from "../domain/validator.js";
import type {
  AfterRequestInput,
  AfterRequestResult,
  BeforeRequestInput,
  BeforeRequestResult,
  CreateAIGuardOptions,
  ExecuteInput,
  ExecuteResult,
  ModelTier,
  Plan,
  UserUsageSnapshot,
} from "../types.js";
import { executeRequest } from "../wrapper/execute.js";

export class AIGuard {
  private readonly userId: string;
  private readonly plan: Plan;
  private readonly store: CreateAIGuardOptions["store"];
  private readonly chatId?: string;
  private readonly modelTier: ModelTier;
  private readonly domain?: DomainProfile;

  constructor(options: CreateAIGuardOptions) {
    if (options.validatePlan !== false) {
      parsePlan(options.plan);
    }

    if (typeof options.domain === "string") {
      const profile = getDomainProfile(options.domain);
      if (!profile) {
        throw new Error(`Unknown domain profile: ${options.domain}`);
      }
      this.domain = profile;
    } else {
      this.domain = options.domain;
    }

    this.userId = options.userId;
    this.plan = options.plan;
    this.store = options.store;
    this.chatId = options.chatId;
    this.modelTier = options.modelTier ?? "standard";
  }

  private context() {
    return {
      userId: this.userId,
      plan: this.plan,
      store: this.store,
      chatId: this.chatId,
      modelTier: this.modelTier,
      domain: this.domain,
    };
  }

  async beforeRequest(input: BeforeRequestInput): Promise<BeforeRequestResult> {
    return beforeRequest(this.context(), input);
  }

  async afterRequest(input: AfterRequestInput): Promise<AfterRequestResult> {
    return afterRequest(this.context(), input);
  }

  async execute(input: ExecuteInput): Promise<ExecuteResult> {
    return executeRequest(this, input);
  }

  async getBalance(): Promise<number> {
    await this.store.initializeUser(this.userId, this.plan.monthlyCoins);
    return this.store.getBalance(this.userId);
  }

  async resetMonthlyUsage(): Promise<void> {
    await this.store.resetMonthlyUsage(this.userId, this.plan.monthlyCoins);
  }

  async getUsageSnapshot(): Promise<UserUsageSnapshot> {
    await this.store.initializeUser(this.userId, this.plan.monthlyCoins);
    const state = await this.store.getUserState(this.userId);
    const chatId = this.chatId ?? "";

    return {
      userId: this.userId,
      balance: state.balance,
      monthlyCoins: state.monthlyCoins,
      chatImageCount: chatId
        ? (state.chatImageCounts.get(chatId) ?? 0)
        : 0,
      chatTokenCount: chatId
        ? (state.chatTokenCounts.get(chatId) ?? 0)
        : 0,
      activeGraceSlots: state.graceSlots.size,
    };
  }
}

export function createAIGuard(options: CreateAIGuardOptions): AIGuard {
  return new AIGuard(options);
}
