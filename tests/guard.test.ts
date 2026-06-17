import { describe, expect, it } from "vitest";
import {
  AIGuardError,
  createAIGuard,
  createMemoryStore,
  PLANS,
} from "../src/index.js";

describe("AIGuard lifecycle", () => {
  it("allows and meters a valid request", async () => {
    const store = createMemoryStore();
    const guard = createAIGuard({
      userId: "user-1",
      plan: PLANS.pro,
      store,
      chatId: "chat-1",
    });

    const pre = await guard.beforeRequest({
      taskId: "generateTitle",
      estimatedInputTokens: 200,
      imageCount: 0,
    });

    expect(pre.allowed).toBe(true);
    expect(pre.systemPrompt).toContain("ONLY the title");

    const post = await guard.afterRequest({
      requestId: pre.requestId,
      taskId: "generateTitle",
      input: "Article about TypeScript generics",
      output: "Understanding TypeScript Generics",
      usage: { inputTokens: 180, outputTokens: 6, imageCount: 0 },
    });

    expect(post.validation.valid).toBe(true);
    expect(post.coinsConsumed).toBeGreaterThan(0);
    expect(post.balanceRemaining).toBeLessThan(PLANS.pro.monthlyCoins);
  });

  it("blocks unknown tasks", async () => {
    const guard = createAIGuard({
      userId: "user-2",
      plan: PLANS.pro,
      store: createMemoryStore(),
    });

    await expect(
      guard.beforeRequest({
        taskId: "unknownTask",
        estimatedInputTokens: 100,
        imageCount: 0,
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_TASK" });
  });

  it("blocks tasks not allowed on plan", async () => {
    const restrictedPlan = {
      ...PLANS.free,
      features: {
        ...PLANS.free.features,
        allowedTaskProfiles: ["generateTitle"],
      },
    };
    const guard = createAIGuard({
      userId: "user-3",
      plan: restrictedPlan,
      store: createMemoryStore(),
    });

    await expect(
      guard.beforeRequest({
        taskId: "summarize",
        estimatedInputTokens: 100,
        imageCount: 0,
      }),
    ).rejects.toMatchObject({ code: "TASK_NOT_ALLOWED" });
  });

  it("enforces input token limits", async () => {
    const guard = createAIGuard({
      userId: "user-4",
      plan: PLANS.free,
      store: createMemoryStore(),
    });

    await expect(
      guard.beforeRequest({
        taskId: "generateTitle",
        estimatedInputTokens: 99999,
        imageCount: 0,
      }),
    ).rejects.toMatchObject({ code: "INPUT_TOKEN_LIMIT" });
  });

  it("enforces image limits per request", async () => {
    const guard = createAIGuard({
      userId: "user-5",
      plan: PLANS.free,
      store: createMemoryStore(),
    });

    await expect(
      guard.beforeRequest({
        taskId: "generalChat",
        estimatedInputTokens: 100,
        imageCount: 5,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_LIMIT" });
  });

  it("resets monthly usage", async () => {
    const store = createMemoryStore();
    const guard = createAIGuard({
      userId: "user-6",
      plan: PLANS.pro,
      store,
    });

    await store.deductCoins("user-6", PLANS.pro.monthlyCoins, false);
    expect(await guard.getBalance()).toBe(0);

    await guard.resetMonthlyUsage();
    expect(await guard.getBalance()).toBe(PLANS.pro.monthlyCoins);
  });
});
