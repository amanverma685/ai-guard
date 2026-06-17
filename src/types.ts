export type ModelTier = "fast" | "standard" | "premium";

export type CoinWeightConfig = {
  inputWeight: number;
  outputWeight: number;
  tokensPerCoin: number;
  imageCoinCost: number;
  visionWeight: number;
  minimumCoinsPerRequest: number;
};

export type PlanLimits = {
  maxInputTokensPerRequest: number;
  maxOutputTokensPerRequest: number;
  maxTotalTokensPerChat: number;
  maxImagesPerChat: number;
  maxImagesPerRequest: number;
  maxRequestsPerMinute: number;
};

export type PlanFeatures = {
  overdraftCompletion: boolean;
  allowedTaskProfiles: string[] | "*";
  allowNegativeBalance: boolean;
};

export type Plan = {
  id: string;
  monthlyCoins: number;
  limits: PlanLimits;
  coinWeights: CoinWeightConfig;
  features: PlanFeatures;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  imageCount: number;
  visionTokens?: number;
};

export type ValidationResult = {
  valid: boolean;
  reason?: string;
  sanitizedOutput?: string;
};

export type DomainProfile = import("./domain/validator.js").DomainProfile;

export type TaskProfile = {
  id: string;
  systemPrompt: string;
  maxOutputTokens: number;
  outputFormat: "text" | "json";
  validator?: (output: string, input: string) => ValidationResult;
  forbiddenPatterns?: RegExp[];
  allowRetry: boolean;
};

export type BeforeRequestInput = {
  taskId: string;
  estimatedInputTokens: number;
  imageCount: number;
  modelTier?: ModelTier;
  /** User message — required for domain input validation when a domain is active */
  input?: string;
  /** Override guard-level domain for this request */
  domainId?: string;
};

export type BeforeRequestResult = {
  allowed: true;
  requestId: string;
  maxOutputTokens: number;
  systemPrompt: string;
  constraints: RequestConstraints;
};

export type RequestConstraints = {
  maxOutputTokens: number;
  maxInputTokens: number;
  systemPrompt: string;
  taskId: string;
  domainId?: string;
};

export type AfterRequestInput = {
  requestId: string;
  taskId: string;
  input: string;
  output: string;
  usage: TokenUsage;
  modelTier?: ModelTier;
  domainId?: string;
};

export type AfterRequestResult = {
  coinsConsumed: number;
  balanceRemaining: number;
  validation: ValidationResult;
  output: string;
};

export type ExecuteInput = {
  taskId: string;
  input: string;
  imageCount?: number;
  modelTier?: ModelTier;
  estimatedInputTokens?: number;
  domainId?: string;
  invoke: (constraints: RequestConstraints) => Promise<{
    text: string;
    usage: TokenUsage;
  }>;
};

export type ExecuteResult = {
  output: string;
  coinsConsumed: number;
  balanceRemaining: number;
  validation: ValidationResult;
  requestId: string;
  retried: boolean;
  /** True when input was off-domain and the refuse message was returned without an LLM call */
  refused?: boolean;
};

export type CreateAIGuardOptions = {
  userId: string;
  plan: Plan;
  store: import("./store/interface.js").UsageStore;
  chatId?: string;
  modelTier?: ModelTier;
  /** Restrict all requests in this guard to a specific domain */
  domain?: DomainProfile | string;
  /** Validate plan config with Zod on construction. Default: true */
  validatePlan?: boolean;
};

export type UserUsageSnapshot = {
  userId: string;
  balance: number;
  monthlyCoins: number;
  chatImageCount: number;
  chatTokenCount: number;
  activeGraceSlots: number;
};
