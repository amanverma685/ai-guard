import { describe, expect, it } from "vitest";
import {
  AIGuardError,
  createAIGuard,
  createDomainProfile,
  createMemoryStore,
  DOMAIN_PROFILES,
  PLANS,
  registerDomainProfile,
  validateDomainInput,
  validateDomainOutput,
} from "../src/index.js";

describe("domain restrictions", () => {
  it("blocks off-domain input before LLM call", async () => {
    const guard = createAIGuard({
      userId: "domain-user",
      plan: PLANS.pro,
      store: createMemoryStore(),
      domain: "ecommerce",
    });

    await expect(
      guard.beforeRequest({
        taskId: "generalChat",
        estimatedInputTokens: 50,
        imageCount: 0,
        input: "What is the weather in Paris today?",
      }),
    ).rejects.toMatchObject({ code: "DOMAIN_VIOLATION" });
  });

  it("allows on-domain input", async () => {
    const guard = createAIGuard({
      userId: "domain-user-2",
      plan: PLANS.pro,
      store: createMemoryStore(),
      domain: "ecommerce",
    });

    const pre = await guard.beforeRequest({
      taskId: "generalChat",
      estimatedInputTokens: 50,
      imageCount: 0,
      input: "Where is my order #12345?",
    });

    expect(pre.systemPrompt).toContain("E-commerce");
    expect(pre.constraints.domainId).toBe("ecommerce");
  });

  it("returns refuse message via execute without spending coins", async () => {
    const guard = createAIGuard({
      userId: "domain-user-3",
      plan: PLANS.pro,
      store: createMemoryStore(),
      domain: "ecommerce",
    });

    const balanceBefore = await guard.getBalance();
    let invoked = false;

    const result = await guard.execute({
      taskId: "generalChat",
      input: "Tell me a joke about politics",
      invoke: async () => {
        invoked = true;
        return {
          text: "should not run",
          usage: { inputTokens: 10, outputTokens: 5, imageCount: 0 },
        };
      },
    });

    expect(invoked).toBe(false);
    expect(result.refused).toBe(true);
    expect(result.coinsConsumed).toBe(0);
    expect(result.output).toBe(DOMAIN_PROFILES.ecommerce!.refuseMessage);
    expect(await guard.getBalance()).toBe(balanceBefore);
  });

  it("rejects off-domain output after LLM call", async () => {
    const guard = createAIGuard({
      userId: "domain-user-4",
      plan: PLANS.pro,
      store: createMemoryStore(),
      domain: "ecommerce",
    });

    const pre = await guard.beforeRequest({
      taskId: "generalChat",
      estimatedInputTokens: 50,
      imageCount: 0,
      input: "How do I track my package?",
    });

    await expect(
      guard.afterRequest({
        requestId: pre.requestId,
        taskId: "generalChat",
        input: "How do I track my package?",
        output: "The stock market is rallying today with strong gains.",
        usage: { inputTokens: 50, outputTokens: 20, imageCount: 0 },
      }),
    ).rejects.toMatchObject({ code: "DOMAIN_VIOLATION" });
  });

  it("supports custom domain profiles", () => {
    registerDomainProfile(
      createDomainProfile({
        id: "legal",
        name: "Legal Docs",
        description: "Contract and policy questions only",
        systemPrompt: "Answer only about contracts and policies.",
        forbiddenKeywords: ["recipe", "weather"],
        refuseMessage: "Legal domain only.",
      }),
    );

    expect(validateDomainInput("review my contract clause", DOMAIN_PROFILES.legal!)).toEqual({
      valid: true,
    });

    expect(validateDomainInput("give me a soup recipe", DOMAIN_PROFILES.legal!).valid).toBe(
      false,
    );
  });

  it("validates strict keyword allowlist when enabled", () => {
    const strict = createDomainProfile({
      id: "strict-test",
      name: "Strict",
      description: "Test",
      systemPrompt: "test",
      allowedKeywords: ["billing"],
      refuseMessage: "nope",
      strictKeywordCheck: true,
    });

    expect(validateDomainInput("billing question", strict).valid).toBe(true);
    expect(validateDomainInput("random hello", strict).valid).toBe(false);
  });

  it("validateDomainOutput catches forbidden topics in response", () => {
    const result = validateDomainOutput(
      "Here is a great cryptocurrency investment tip",
      "tell me about returns",
      DOMAIN_PROFILES.ecommerce!,
    );
    expect(result.valid).toBe(false);
  });
});
