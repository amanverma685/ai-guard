import { describe, expect, it } from "vitest";
import {
  AIGuardError,
  createAIGuard,
  createMemoryStore,
  PLANS,
  validateTitle,
  validateSummary,
} from "../src/index.js";

describe("task validation", () => {
  it("accepts a clean title", () => {
    const result = validateTitle("My Article Title", "context");
    expect(result.valid).toBe(true);
    expect(result.sanitizedOutput).toBe("My Article Title");
  });

  it("rejects explanatory title responses", () => {
    const result = validateTitle("Here is the title: Foo", "context");
    expect(result.valid).toBe(false);
  });

  it("rejects multi-line titles", () => {
    const result = validateTitle("Line one\nLine two", "context");
    expect(result.valid).toBe(false);
  });

  it("strips surrounding quotes from titles", () => {
    const result = validateTitle('"Quoted Title"', "context");
    expect(result.valid).toBe(true);
    expect(result.sanitizedOutput).toBe("Quoted Title");
  });

  it("rejects off-topic summaries", () => {
    const result = validateSummary("As an AI I cannot help", "some input");
    expect(result.valid).toBe(false);
  });

  it("rejects invalid generateTitle output via afterRequest", async () => {
    const guard = createAIGuard({
      userId: "user-val",
      plan: PLANS.pro,
      store: createMemoryStore(),
    });

    const pre = await guard.beforeRequest({
      taskId: "generateTitle",
      estimatedInputTokens: 50,
      imageCount: 0,
    });

    await expect(
      guard.afterRequest({
        requestId: pre.requestId,
        taskId: "generateTitle",
        input: "context",
        output: "Let me know if you need anything else",
        usage: { inputTokens: 50, outputTokens: 12, imageCount: 0 },
      }),
    ).rejects.toMatchObject({ code: "TASK_VALIDATION_FAILED" });
  });

  it("enforces per-chat image limits", async () => {
    const store = createMemoryStore();
    const guard = createAIGuard({
      userId: "user-img",
      plan: PLANS.free,
      store,
      chatId: "chat-img",
    });

    await store.incrementChatImageCount("user-img", "chat-img", 3);

    await expect(
      guard.beforeRequest({
        taskId: "generalChat",
        estimatedInputTokens: 100,
        imageCount: 1,
      }),
    ).rejects.toMatchObject({ code: "IMAGE_LIMIT" });
  });
});
