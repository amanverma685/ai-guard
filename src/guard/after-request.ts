import { CoinCalculator } from "../coins/calculator.js";
import { AIGuardError } from "../errors.js";
import { getDomainProfile } from "../domain/registry.js";
import { validateDomainOutput } from "../domain/validator.js";
import type { DomainProfile } from "../domain/validator.js";
import { getTaskProfile } from "../tasks/registry.js";
import { validateOutput } from "../tasks/validator.js";
import type {
  AfterRequestInput,
  AfterRequestResult,
  ModelTier,
  Plan,
} from "../types.js";
import type { UsageStore } from "../store/interface.js";

export type AfterRequestContext = {
  userId: string;
  plan: Plan;
  store: UsageStore;
  chatId?: string;
  modelTier: ModelTier;
  domain?: DomainProfile;
};

function resolveDomain(
  ctx: AfterRequestContext,
  input: AfterRequestInput,
): DomainProfile | undefined {
  if (input.domainId) {
    return getDomainProfile(input.domainId);
  }
  return ctx.domain;
}

export async function afterRequest(
  ctx: AfterRequestContext,
  input: AfterRequestInput,
): Promise<AfterRequestResult> {
  const { userId, plan, store, chatId, modelTier } = ctx;
  const task = getTaskProfile(input.taskId);

  if (!task) {
    throw new AIGuardError("UNKNOWN_TASK", `Unknown task profile: ${input.taskId}`);
  }

  const userState = await store.getUserState(userId);
  if (!userState.graceSlots.has(input.requestId)) {
    throw new AIGuardError(
      "GRACE_SLOT_NOT_FOUND",
      `No active grace slot for request: ${input.requestId}`,
    );
  }

  if (input.usage.outputTokens > plan.limits.maxOutputTokensPerRequest) {
    await store.releaseGraceSlot(userId, input.requestId);
    throw new AIGuardError(
      "OUTPUT_TOKEN_LIMIT",
      "Output tokens exceed plan limit",
      {
        tokens: input.usage.outputTokens,
        limit: plan.limits.maxOutputTokensPerRequest,
      },
    );
  }

  const calculator = new CoinCalculator(
    input.modelTier ?? modelTier,
    plan.coinWeights,
  );
  const coinsConsumed = calculator.calculate(
    input.usage,
    input.modelTier ?? modelTier,
  );

  const validation = validateOutput(input.output, input.input, {
    forbiddenPatterns: task.forbiddenPatterns,
    validator: task.validator,
  });

  let output = validation.sanitizedOutput ?? input.output.trim();

  const activeDomain = resolveDomain(ctx, input);

  if (activeDomain) {
    const domainValidation = validateDomainOutput(output, input.input, activeDomain);
    if (!domainValidation.valid) {
      await store.releaseGraceSlot(userId, input.requestId);
      throw new AIGuardError(
        "DOMAIN_VIOLATION",
        domainValidation.reason ?? "Output is outside the allowed domain",
        {
          refuseMessage: activeDomain.refuseMessage,
          domainId: activeDomain.id,
        },
      );
    }
    output = domainValidation.sanitizedOutput ?? output;
  }

  if (chatId) {
    const totalTokens = input.usage.inputTokens + input.usage.outputTokens;
    await store.incrementChatTokenCount(userId, chatId, totalTokens);
    if (input.usage.imageCount > 0) {
      await store.incrementChatImageCount(userId, chatId, input.usage.imageCount);
    }
  }

  const balanceRemaining = await store.deductCoins(
    userId,
    coinsConsumed,
    plan.features.allowNegativeBalance,
  );

  await store.releaseGraceSlot(userId, input.requestId);

  if (!validation.valid) {
    throw new AIGuardError(
      "TASK_VALIDATION_FAILED",
      validation.reason ?? "Task output validation failed",
      { validation, coinsConsumed, balanceRemaining },
    );
  }

  return {
    coinsConsumed,
    balanceRemaining,
    validation,
    output,
  };
}
