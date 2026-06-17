import { describe, expect, it } from "vitest";
import { parsePlan, safeParsePlan } from "../src/config/schemas.js";
import { PLANS } from "../src/plans.js";

describe("plan schemas", () => {
  it("parses built-in pro plan", () => {
    const plan = parsePlan(PLANS.pro);
    expect(plan.id).toBe("pro");
    expect(plan.monthlyCoins).toBe(500);
  });

  it("rejects invalid plan limits", () => {
    const result = safeParsePlan({
      ...PLANS.free,
      limits: {
        ...PLANS.free.limits,
        maxInputTokensPerRequest: -1,
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid coin weights", () => {
    const result = safeParsePlan({
      ...PLANS.free,
      coinWeights: {
        ...PLANS.free.coinWeights,
        tokensPerCoin: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts wildcard allowedTaskProfiles", () => {
    const plan = parsePlan({
      ...PLANS.pro,
      features: { ...PLANS.pro.features, allowedTaskProfiles: "*" },
    });
    expect(plan.features.allowedTaskProfiles).toBe("*");
  });
});
