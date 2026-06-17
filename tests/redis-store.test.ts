import { describe, expect, it } from "vitest";
import { createAIGuard, PLANS } from "../src/index.js";
import { createRedisStore, type RedisClient } from "../src/redis.js";

function createMockRedis(): RedisClient & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key: string) {
      return data.get(key) ?? null;
    },
    async set(key: string, value: string) {
      data.set(key, value);
    },
  };
}

describe("RedisUsageStore", () => {
  it("persists balance across store instances", async () => {
    const redis = createMockRedis();
    const store = createRedisStore({ client: redis });

    await store.initializeUser("user-redis", PLANS.pro.monthlyCoins);
    await store.deductCoins("user-redis", 10, false);

    const store2 = createRedisStore({ client: redis });
    expect(await store2.getBalance("user-redis")).toBe(PLANS.pro.monthlyCoins - 10);
  });

  it("tracks chat image counts", async () => {
    const store = createRedisStore({ client: createMockRedis() });

    await store.initializeUser("user-img", PLANS.pro.monthlyCoins);
    await store.incrementChatImageCount("user-img", "chat-1", 2);

    expect(await store.getChatImageCount("user-img", "chat-1")).toBe(2);
  });

  it("works with AIGuard end-to-end", async () => {
    const store = createRedisStore({ client: createMockRedis() });
    const guard = createAIGuard({
      userId: "user-e2e",
      plan: PLANS.pro,
      store,
      chatId: "chat-e2e",
    });

    const result = await guard.execute({
      taskId: "generateTitle",
      input: "Guide to Redis caching",
      invoke: async () => ({
        text: "Redis Caching Guide",
        usage: { inputTokens: 100, outputTokens: 5, imageCount: 0 },
      }),
    });

    expect(result.output).toBe("Redis Caching Guide");
    expect(result.balanceRemaining).toBeLessThan(PLANS.pro.monthlyCoins);
  });

  it("resets monthly usage", async () => {
    const store = createRedisStore({ client: createMockRedis() });
    await store.initializeUser("user-reset", 100);
    await store.deductCoins("user-reset", 100, false);
    await store.resetMonthlyUsage("user-reset", 100);
    expect(await store.getBalance("user-reset")).toBe(100);
  });
});
