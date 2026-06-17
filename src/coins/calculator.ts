import type { CoinWeightConfig, ModelTier, TokenUsage } from "../types.js";
import { DEFAULT_WEIGHTS } from "./weights.js";

export type CoinCalculationInput = TokenUsage & {
  modelTier?: ModelTier;
  weights?: Partial<CoinWeightConfig>;
};

export function calculateCoins(input: CoinCalculationInput): number {
  const tier = input.modelTier ?? "standard";
  const weights: CoinWeightConfig = {
    ...DEFAULT_WEIGHTS[tier],
    ...input.weights,
  };

  const visionTokens = input.visionTokens ?? 0;

  const weightedTokens =
    input.inputTokens * weights.inputWeight +
    input.outputTokens * weights.outputWeight +
    visionTokens * weights.visionWeight;

  const tokenCoins =
    weightedTokens > 0
      ? Math.ceil(weightedTokens / weights.tokensPerCoin)
      : 0;

  const imageCoins = input.imageCount * weights.imageCoinCost;

  const rawCoins = tokenCoins + imageCoins;

  return Math.max(rawCoins, weights.minimumCoinsPerRequest);
}

export class CoinCalculator {
  private readonly defaultTier: ModelTier;
  private readonly planWeights: CoinWeightConfig;

  constructor(defaultTier: ModelTier = "standard", planWeights?: CoinWeightConfig) {
    this.defaultTier = defaultTier;
    this.planWeights = planWeights ?? DEFAULT_WEIGHTS[defaultTier];
  }

  calculate(usage: TokenUsage, modelTier?: ModelTier): number {
    return calculateCoins({
      ...usage,
      modelTier: modelTier ?? this.defaultTier,
      weights: this.planWeights,
    });
  }
}
