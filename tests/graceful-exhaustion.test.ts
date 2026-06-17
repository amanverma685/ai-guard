import { describe, expect, it } from "vitest";
import {
  createAIGuard,
  createMemoryStore,
  PLANS,
  AIGuardError,
} from "../src/index.js";

describe("graceful coin exhaustion", () => {
  it("completes response when deduction exceeds remaining balance", async () => {
    const store = createMemoryStore();
    const guard = createAIGuard({
      userId: "user-exhaust",
      plan: PLANS.pro,
      store,
    });

    await store.initializeUser("user-exhaust", 1);

    const pre = await guard.beforeRequest({
      taskId: "generateTitle",
      estimatedInputTokens: 500,
      imageCount: 0,
    });

    const post = await guard.afterRequest({
      requestId: pre.requestId,
      taskId: "generateTitle",
      input: "Long article context",
      output: "A Great Title",
      usage: { inputTokens: 5000, outputTokens: 2000, imageCount: 0 },
    });

    expect(post.output).toBe("A Great Title");
    expect(post.coinsConsumed).toBeGreaterThan(1);
    expect(post.balanceRemaining).toBe(0);
  });

  it("blocks the next request after balance reaches zero", async () => {
    const store = createMemoryStore();
    const guard = createAIGuard({
      userId: "user-blocked",
      plan: PLANS.pro,
      store,
    });

    await store.initializeUser("user-blocked", 1);

    const pre = await guard.beforeRequest({
      taskId: "generateTitle",
      estimatedInputTokens: 100,
      imageCount: 0,
    });

    await guard.afterRequest({
      requestId: pre.requestId,
      taskId: "generateTitle",
      input: "context",
      output: "Title Here",
      usage: { inputTokens: 3000, outputTokens: 1000, imageCount: 0 },
    });

    await expect(
      guard.beforeRequest({
        taskId: "generateTitle",
        estimatedInputTokens: 100,
        imageCount: 0,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_COINS" });
  });

  it("does not require sufficient coins upfront for expensive requests", async () => {
    const store = createMemoryStore();
    const guard = createAIGuard({
      userId: "user-upfront",
      plan: PLANS.pro,
      store,
    });

    await store.initializeUser("user-upfront", 2);

    const pre = await guard.beforeRequest({
      taskId: "summarize",
      estimatedInputTokens: 200,
      imageCount: 0,
    });

    expect(pre.allowed).toBe(true);
  });
});

describe("execute wrapper", () => {
  it("runs full lifecycle via execute()", async () => {
    const guard = createAIGuard({
      userId: "user-exec",
      plan: PLANS.pro,
      store: createMemoryStore(),
    });

    const result = await guard.execute({
      taskId: "generateTitle",
      input: "Blog post about npm packages",
      invoke: async (constraints) => ({
        text: "Building npm Packages",
        usage: {
          inputTokens: 120,
          outputTokens: 5,
          imageCount: 0,
        },
      }),
    });

    expect(result.output).toBe("Building npm Packages");
    expect(result.coinsConsumed).toBeGreaterThan(0);
    expect(result.retried).toBe(false);
  });

  it("retries once on validation failure when allowed", async () => {
    const guard = createAIGuard({
      userId: "user-retry",
      plan: PLANS.pro,
      store: createMemoryStore(),
    });

    let attempts = 0;
    const result = await guard.execute({
      taskId: "generateTitle",
      input: "Some context",
      invoke: async () => {
        attempts += 1;
        if (attempts === 1) {
          return {
            text: "Here is the title: Bad Format",
            usage: { inputTokens: 50, outputTokens: 10, imageCount: 0 },
          };
        }
        return {
          text: "Clean Title",
          usage: { inputTokens: 50, outputTokens: 4, imageCount: 0 },
        };
      },
    });

    expect(attempts).toBe(2);
    expect(result.retried).toBe(true);
    expect(result.output).toBe("Clean Title");
  });
});
