import { describe, expect, it } from "vitest";
import { calculateCoins, CoinCalculator } from "../src/coins/calculator.js";

describe("calculateCoins", () => {
  it("converts weighted tokens to coins", () => {
    const coins = calculateCoins({
      inputTokens: 1000,
      outputTokens: 500,
      imageCount: 0,
      modelTier: "standard",
    });
    // (1000*1.5 + 500*2.0) / 1000 = 2.5 -> ceil 3
    expect(coins).toBe(3);
  });

  it("applies minimum coins per request", () => {
    const coins = calculateCoins({
      inputTokens: 0,
      outputTokens: 0,
      imageCount: 0,
      modelTier: "fast",
    });
    expect(coins).toBe(1);
  });

  it("charges extra for images", () => {
    const coins = calculateCoins({
      inputTokens: 100,
      outputTokens: 50,
      imageCount: 2,
      modelTier: "standard",
    });
    // token coins: ceil((150+100)/1000) = 1, image: 2*10 = 20 -> max(21, 1) = 21
    expect(coins).toBe(21);
  });

  it("uses premium tier weights", () => {
    const calc = new CoinCalculator("premium");
    const coins = calc.calculate({
      inputTokens: 2000,
      outputTokens: 1000,
      imageCount: 0,
    });
    // (2000*2.5 + 1000*3) / 1000 = 8 -> 8
    expect(coins).toBe(8);
  });

  it("includes vision tokens when provided", () => {
    const coins = calculateCoins({
      inputTokens: 0,
      outputTokens: 0,
      imageCount: 0,
      visionTokens: 3000,
      modelTier: "fast",
    });
    expect(coins).toBe(3);
  });
});
