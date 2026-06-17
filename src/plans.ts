import type { Plan } from "./types.js";
import { DEFAULT_WEIGHTS } from "./coins/weights.js";

export const PLANS: Record<string, Plan> = {
  free: {
    id: "free",
    monthlyCoins: 50,
    limits: {
      maxInputTokensPerRequest: 4000,
      maxOutputTokensPerRequest: 1024,
      maxTotalTokensPerChat: 20000,
      maxImagesPerChat: 3,
      maxImagesPerRequest: 1,
      maxRequestsPerMinute: 10,
    },
    coinWeights: DEFAULT_WEIGHTS.fast,
    features: {
      overdraftCompletion: true,
      allowedTaskProfiles: ["generateTitle", "summarize", "generalChat"],
      allowNegativeBalance: false,
    },
  },
  pro: {
    id: "pro",
    monthlyCoins: 500,
    limits: {
      maxInputTokensPerRequest: 16000,
      maxOutputTokensPerRequest: 4096,
      maxTotalTokensPerChat: 100000,
      maxImagesPerChat: 20,
      maxImagesPerRequest: 5,
      maxRequestsPerMinute: 60,
    },
    coinWeights: DEFAULT_WEIGHTS.standard,
    features: {
      overdraftCompletion: true,
      allowedTaskProfiles: "*",
      allowNegativeBalance: false,
    },
  },
  enterprise: {
    id: "enterprise",
    monthlyCoins: 5000,
    limits: {
      maxInputTokensPerRequest: 128000,
      maxOutputTokensPerRequest: 16384,
      maxTotalTokensPerChat: 500000,
      maxImagesPerChat: 100,
      maxImagesPerRequest: 10,
      maxRequestsPerMinute: 300,
    },
    coinWeights: DEFAULT_WEIGHTS.premium,
    features: {
      overdraftCompletion: true,
      allowedTaskProfiles: "*",
      allowNegativeBalance: true,
    },
  },
};

export function getPlan(planId: keyof typeof PLANS | string): Plan {
  const plan = PLANS[planId];
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }
  return plan;
}
