/**
 * Basic integration example — run with: npx tsx examples/basic-usage.ts
 */
import {
  createAIGuard,
  createMemoryStore,
  PLANS,
} from "../src/index.js";

async function mockProvider(
  systemPrompt: string,
  userInput: string,
  maxTokens: number,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; imageCount: number } }> {
  // Replace this with your real OpenAI / Anthropic / etc. SDK call.
  const text =
    systemPrompt.includes("title") && !systemPrompt.includes("invalid")
      ? "Building AI Guard npm Packages"
      : "Off-topic response";

  return {
    text,
    usage: {
      inputTokens: Math.ceil((systemPrompt.length + userInput.length) / 4),
      outputTokens: Math.ceil(text.length / 4),
      imageCount: 0,
    },
  };
}

async function main() {
  const store = createMemoryStore();
  const guard = createAIGuard({
    userId: "demo-user",
    plan: PLANS.pro,
    store,
    chatId: "demo-chat",
  });

  console.log("Initial balance:", await guard.getBalance());

  const titleResult = await guard.execute({
    taskId: "generateTitle",
    input: "A technical blog post about metering AI usage with npm packages",
    invoke: async (constraints) => {
      const response = await mockProvider(
        constraints.systemPrompt,
        "A technical blog post about metering AI usage with npm packages",
        constraints.maxOutputTokens,
      );
      return response;
    },
  });

  console.log("Generated title:", titleResult.output);
  console.log("Coins consumed:", titleResult.coinsConsumed);
  console.log("Balance remaining:", titleResult.balanceRemaining);

  const snapshot = await guard.getUsageSnapshot();
  console.log("Usage snapshot:", snapshot);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
