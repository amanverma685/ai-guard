# @amanv685/ai-guard

Provider-agnostic npm package for enforcing **AI coin budgets**, **token/image limits**, and **task-scoped LLM responses**.

AI coins and tokens are separate units:

- **Tokens** — technical caps on input/output size (enforced before the request).
- **AI coins** — user-facing plan allowance (deducted after the response completes).

A request that starts with a positive coin balance always **completes fully**; coins are deducted afterward and may bring the balance to zero. The next request is blocked when balance is `0`.

## Install

```bash
npm install @amanv685/ai-guard
```

## Quick start

```typescript
import {
  createAIGuard,
  createMemoryStore,
  PLANS,
} from "@amanv685/ai-guard";

const store = createMemoryStore();
const guard = createAIGuard({
  userId: "user_123",
  plan: PLANS.pro,
  store,
  chatId: "chat_abc",
});

const result = await guard.execute({
  taskId: "generateTitle",
  input: "Article about building npm packages for AI metering",
  invoke: async (constraints) => {
    // Call your provider (OpenAI, Anthropic, etc.)
    // Respect constraints.maxOutputTokens and constraints.systemPrompt
    const text = await callYourProvider({
      system: constraints.systemPrompt,
      user: input,
      maxTokens: constraints.maxOutputTokens,
    });

    return {
      text,
      usage: {
        inputTokens: 180,
        outputTokens: 6,
        imageCount: 0,
      },
    };
  },
});

console.log(result.output);           // "Building npm Packages"
console.log(result.coinsConsumed);    // e.g. 1
console.log(result.balanceRemaining); // e.g. 499
```

## Low-level API

Use `beforeRequest` / `afterRequest` when you manage the provider call yourself:

```typescript
const pre = await guard.beforeRequest({
  taskId: "generateTitle",
  estimatedInputTokens: 400,
  imageCount: 0,
});

// pre.constraints.maxOutputTokens
// pre.constraints.systemPrompt
// pre.requestId

const modelText = await yourProvider(pre.constraints);

const post = await guard.afterRequest({
  requestId: pre.requestId,
  taskId: "generateTitle",
  input: userInput,
  output: modelText,
  usage: { inputTokens: 380, outputTokens: 8, imageCount: 0 },
});
```

## AI coin formula

```
weightedTokens = (inputTokens × inputWeight)
               + (outputTokens × outputWeight)
               + (visionTokens × visionWeight)

tokenCoins = ceil(weightedTokens / tokensPerCoin)
imageCoins = imageCount × imageCoinCost

coinsConsumed = max(tokenCoins + imageCoins, minimumCoinsPerRequest)
```

Default weights by model tier:

| Tier     | inputWeight | outputWeight | tokensPerCoin | imageCoinCost |
|----------|-------------|--------------|---------------|---------------|
| fast     | 1.0         | 1.5          | 1000          | 5             |
| standard | 1.5         | 2.0          | 1000          | 10            |
| premium  | 2.5         | 3.0          | 1000          | 20            |

Override per plan via `plan.coinWeights`.

## Plans

Built-in presets: `PLANS.free`, `PLANS.pro`, `PLANS.enterprise`.

Each plan defines:

- `monthlyCoins` — starting balance (reset via `guard.resetMonthlyUsage()`)
- `limits` — token, image, and rate limits
- `features.allowedTaskProfiles` — task whitelist or `"*"`

## Task profiles

Built-in tasks:

| Task ID         | Behavior                                      |
|-----------------|-----------------------------------------------|
| `generateTitle` | Returns only a title from context (max 80 chars) |
| `summarize`     | Concise summary without meta-commentary       |
| `generalChat`   | Answers from context only                     |

Register custom tasks:

```typescript
import { registerTaskProfile } from "@amanv685/ai-guard";

registerTaskProfile({
  id: "extractKeywords",
  systemPrompt: "Return comma-separated keywords only.",
  maxOutputTokens: 64,
  outputFormat: "text",
  allowRetry: true,
  validator: (output) => ({ valid: output.length > 0, sanitizedOutput: output }),
});
```

## Graceful coin exhaustion

1. **Pre-check** — `balance > 0` required to start a new request.
2. **During generation** — never abort mid-response because of coin balance.
3. **Post-check** — deduct coins; balance clamps to `0` (unless `allowNegativeBalance` on enterprise).
4. **Next request** — blocked with `INSUFFICIENT_COINS`.

## Error codes

| Code                    | When                                      |
|-------------------------|-------------------------------------------|
| `INSUFFICIENT_COINS`    | No coins left for a new request           |
| `INPUT_TOKEN_LIMIT`     | Estimated input exceeds plan cap          |
| `OUTPUT_TOKEN_LIMIT`    | Actual output tokens exceed plan cap      |
| `CHAT_TOKEN_LIMIT`      | Chat session token budget exceeded        |
| `IMAGE_LIMIT`           | Per-request or per-chat image cap hit     |
| `RATE_LIMIT`            | Too many requests per minute              |
| `TASK_VALIDATION_FAILED`| Output failed task validator              |
| `UNKNOWN_TASK`          | Task profile not found                    |
| `TASK_NOT_ALLOWED`      | Task not on plan whitelist                |
| `DOMAIN_VIOLATION`      | Input or output outside the allowed domain |

## Domain restrictions

Restrict the agent to **only answer within a specific domain** (e.g. e-commerce, healthcare admin, legal docs).

### Built-in domains

- `ecommerce` — orders, shipping, returns, products
- `healthcare` — appointments, billing, insurance (not medical advice)

### Guard-level domain (applies to all requests)

```typescript
import { createAIGuard, createMemoryStore, PLANS } from "@amanv685/ai-guard";

const guard = createAIGuard({
  userId: "user_123",
  plan: PLANS.pro,
  store: createMemoryStore(),
  domain: "ecommerce", // or pass a full DomainProfile object
});

const result = await guard.execute({
  taskId: "generalChat",
  input: "Where is my order #4821?",
  invoke: async (constraints) => {
    // constraints.systemPrompt already includes domain rules
    return callYourProvider(constraints);
  },
});

// Off-domain input — no LLM call, no coins spent:
const refused = await guard.execute({
  taskId: "generalChat",
  input: "What's the weather today?",
  invoke: async () => ({ text: "...", usage: { inputTokens: 0, outputTokens: 0, imageCount: 0 } }),
});
// refused.refused === true
// refused.output === "I can only help with orders, products, shipping..."
```

### Custom domain

```typescript
import { createDomainProfile, registerDomainProfile } from "@amanv685/ai-guard";

registerDomainProfile(
  createDomainProfile({
    id: "myProduct",
    name: "My SaaS Product",
    description: "Features, pricing, and account management only",
    systemPrompt:
      "You answer ONLY about My SaaS features, pricing, billing, and account settings using the provided context.",
    forbiddenKeywords: ["competitor", "weather", "politics"],
    allowedKeywords: ["account", "pricing", "feature", "billing", "plan"],
    strictKeywordCheck: false, // true = input must contain an allowed keyword
    refuseMessage: "I can only help with questions about My SaaS.",
    inputValidator: (input) => ({
      valid: !input.includes("competitor"),
      reason: "Competitor comparisons are not allowed",
    }),
    outputValidator: (output, input) => ({
      valid: output.length > 0,
      sanitizedOutput: output,
    }),
  }),
);
```

### How domain enforcement works

1. **Input check** (before LLM) — blocks forbidden keywords; optional allowlist; custom `inputValidator`. Saves coins.
2. **System prompt** — domain rules prepended to the task prompt.
3. **Output check** (after LLM) — rejects responses that reference off-domain topics.

For semantic classification (e.g. detecting subtle off-topic questions), plug in a custom `inputValidator` using embeddings or a lightweight classifier.

## Storage

### In-memory (dev / single server)

```typescript
import { createMemoryStore } from "@amanv685/ai-guard";

const store = createMemoryStore();
await store.initializeUser("user_123", 500);
```

### Redis (production / multi-instance)

```typescript
import { createAIGuard, PLANS } from "@amanv685/ai-guard";
import { createRedisStore } from "@amanv685/ai-guard/redis";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL);
const store = createRedisStore({
  client: {
    get: (key) => redis.get(key),
    set: (key, value) => redis.set(key, value),
  },
  keyPrefix: "myapp:ai-guard:",
});

const guard = createAIGuard({ userId: "user_123", plan: PLANS.pro, store });
```

Implement the `UsageStore` interface for Postgres or other backends.

## Plan validation (Zod)

Plans are validated on `createAIGuard()` by default:

```typescript
import { parsePlan, safeParsePlan, planSchema } from "@amanv685/ai-guard";

const customPlan = parsePlan({
  id: "starter",
  monthlyCoins: 200,
  limits: { /* ... */ },
  coinWeights: { /* ... */ },
  features: { /* ... */ },
});

const guard = createAIGuard({
  userId: "user_123",
  plan: customPlan,
  store,
  validatePlan: true, // default; set false to skip
});
```

## Example app

```bash
npm run example
```

See [`examples/basic-usage.ts`](examples/basic-usage.ts) for a full integration demo.

## Publish

```bash
npm run build
npm publish --access public
```

`prepublishOnly` runs typecheck, tests, and build automatically.

## Development

```bash
npm install
npm test
npm run build
npm run example
```

## License

MIT
