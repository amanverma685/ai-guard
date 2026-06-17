import type { CoinWeightConfig, ModelTier } from "../types.js";

export const DEFAULT_WEIGHTS: Record<ModelTier, CoinWeightConfig> = {
  fast: {
    inputWeight: 1.0,
    outputWeight: 1.5,
    tokensPerCoin: 1000,
    imageCoinCost: 5,
    visionWeight: 1.0,
    minimumCoinsPerRequest: 1,
  },
  standard: {
    inputWeight: 1.5,
    outputWeight: 2.0,
    tokensPerCoin: 1000,
    imageCoinCost: 10,
    visionWeight: 1.5,
    minimumCoinsPerRequest: 1,
  },
  premium: {
    inputWeight: 2.5,
    outputWeight: 3.0,
    tokensPerCoin: 1000,
    imageCoinCost: 20,
    visionWeight: 2.0,
    minimumCoinsPerRequest: 1,
  },
};

export function getWeightsForTier(
  tier: ModelTier,
  override?: Partial<CoinWeightConfig>,
): CoinWeightConfig {
  return { ...DEFAULT_WEIGHTS[tier], ...override };
}
