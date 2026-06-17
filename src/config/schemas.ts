import { z } from "zod";
import type { CoinWeightConfig, Plan, PlanFeatures, PlanLimits } from "../types.js";

export const coinWeightConfigSchema = z.object({
  inputWeight: z.number().positive(),
  outputWeight: z.number().positive(),
  tokensPerCoin: z.number().positive(),
  imageCoinCost: z.number().nonnegative(),
  visionWeight: z.number().nonnegative(),
  minimumCoinsPerRequest: z.number().positive(),
});

export const planLimitsSchema = z.object({
  maxInputTokensPerRequest: z.number().int().positive(),
  maxOutputTokensPerRequest: z.number().int().positive(),
  maxTotalTokensPerChat: z.number().int().positive(),
  maxImagesPerChat: z.number().int().nonnegative(),
  maxImagesPerRequest: z.number().int().nonnegative(),
  maxRequestsPerMinute: z.number().int().positive(),
});

export const planFeaturesSchema = z.object({
  overdraftCompletion: z.boolean(),
  allowedTaskProfiles: z.union([z.literal("*"), z.array(z.string().min(1))]),
  allowNegativeBalance: z.boolean(),
});

export const planSchema = z.object({
  id: z.string().min(1),
  monthlyCoins: z.number().nonnegative(),
  limits: planLimitsSchema,
  coinWeights: coinWeightConfigSchema,
  features: planFeaturesSchema,
});

export type ParsedPlan = z.infer<typeof planSchema>;

export function parsePlan(input: unknown): Plan {
  return planSchema.parse(input) as Plan;
}

export function safeParsePlan(input: unknown) {
  return planSchema.safeParse(input);
}

export function parsePlanLimits(input: unknown): PlanLimits {
  return planLimitsSchema.parse(input) as PlanLimits;
}

export function parseCoinWeights(input: unknown): CoinWeightConfig {
  return coinWeightConfigSchema.parse(input) as CoinWeightConfig;
}

export function parsePlanFeatures(input: unknown): PlanFeatures {
  return planFeaturesSchema.parse(input) as PlanFeatures;
}
