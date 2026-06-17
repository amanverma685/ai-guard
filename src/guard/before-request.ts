import { randomUUID } from "node:crypto";
import { AIGuardError } from "../errors.js";
import {
  buildDomainSystemPrompt,
  validateDomainInput,
  type DomainProfile,
} from "../domain/validator.js";
import { getDomainProfile } from "../domain/registry.js";
import { getTaskProfile, isTaskAllowed } from "../tasks/registry.js";
import type {
  BeforeRequestInput,
  BeforeRequestResult,
  Plan,
} from "../types.js";
import type { UsageStore } from "../store/interface.js";

export type BeforeRequestContext = {
  userId: string;
  plan: Plan;
  store: UsageStore;
  chatId?: string;
  domain?: DomainProfile;
};

function resolveDomain(
  ctx: BeforeRequestContext,
  input: BeforeRequestInput,
): DomainProfile | undefined {
  if (input.domainId) {
    return getDomainProfile(input.domainId);
  }
  return ctx.domain;
}

export async function beforeRequest(
  ctx: BeforeRequestContext,
  input: BeforeRequestInput,
): Promise<BeforeRequestResult> {
  const { userId, plan, store, chatId } = ctx;
  const task = getTaskProfile(input.taskId);

  if (!task) {
    throw new AIGuardError("UNKNOWN_TASK", `Unknown task profile: ${input.taskId}`);
  }

  if (!isTaskAllowed(input.taskId, plan.features.allowedTaskProfiles)) {
    throw new AIGuardError(
      "TASK_NOT_ALLOWED",
      `Task "${input.taskId}" is not allowed on plan "${plan.id}"`,
    );
  }

  const domain = resolveDomain(ctx, input);
  if (domain) {
    if (input.domainId && !getDomainProfile(input.domainId)) {
      throw new AIGuardError(
        "DOMAIN_VIOLATION",
        `Unknown domain profile: ${input.domainId}`,
      );
    }

    if (input.input !== undefined) {
      const domainInput = validateDomainInput(input.input, domain);
      if (!domainInput.valid) {
        throw new AIGuardError(
          "DOMAIN_VIOLATION",
          domainInput.reason ?? "Input is outside the allowed domain",
          { refuseMessage: domain.refuseMessage, domainId: domain.id },
        );
      }
    }
  }

  await store.initializeUser(userId, plan.monthlyCoins);

  const requestCount = await store.recordRequest(userId);
  if (requestCount > plan.limits.maxRequestsPerMinute) {
    throw new AIGuardError("RATE_LIMIT", "Request rate limit exceeded", {
      limit: plan.limits.maxRequestsPerMinute,
      current: requestCount,
    });
  }

  if (input.estimatedInputTokens > plan.limits.maxInputTokensPerRequest) {
    throw new AIGuardError(
      "INPUT_TOKEN_LIMIT",
      "Estimated input tokens exceed plan limit",
      {
        estimated: input.estimatedInputTokens,
        limit: plan.limits.maxInputTokensPerRequest,
      },
    );
  }

  if (input.imageCount > plan.limits.maxImagesPerRequest) {
    throw new AIGuardError("IMAGE_LIMIT", "Image count exceeds per-request limit", {
      count: input.imageCount,
      limit: plan.limits.maxImagesPerRequest,
    });
  }

  if (chatId) {
    const chatImages = await store.getChatImageCount(userId, chatId);
    if (chatImages + input.imageCount > plan.limits.maxImagesPerChat) {
      throw new AIGuardError("IMAGE_LIMIT", "Image count exceeds per-chat limit", {
        current: chatImages,
        adding: input.imageCount,
        limit: plan.limits.maxImagesPerChat,
      });
    }

    const chatTokens = await store.getChatTokenCount(userId, chatId);
    if (
      chatTokens + input.estimatedInputTokens >
      plan.limits.maxTotalTokensPerChat
    ) {
      throw new AIGuardError(
        "CHAT_TOKEN_LIMIT",
        "Chat token budget would be exceeded",
        {
          current: chatTokens,
          adding: input.estimatedInputTokens,
          limit: plan.limits.maxTotalTokensPerChat,
        },
      );
    }
  }

  const balance = await store.getBalance(userId);

  // New requests require a positive balance. Once started, responses always complete
  // even if coin deduction brings the balance to zero (handled in afterRequest).
  if (balance <= 0) {
    throw new AIGuardError("INSUFFICIENT_COINS", "AI coin balance is exhausted", {
      balance,
    });
  }

  const requestId = randomUUID();
  await store.reserveGraceSlot(userId, requestId, chatId);

  const maxOutputTokens = Math.min(
    task.maxOutputTokens,
    plan.limits.maxOutputTokensPerRequest,
  );

  const systemPrompt = domain
    ? buildDomainSystemPrompt(domain, task.systemPrompt)
    : task.systemPrompt;

  const constraints = {
    maxOutputTokens,
    maxInputTokens: plan.limits.maxInputTokensPerRequest,
    systemPrompt,
    taskId: input.taskId,
    domainId: domain?.id,
  };

  return {
    allowed: true,
    requestId,
    maxOutputTokens,
    systemPrompt,
    constraints,
  };
}
