import { AIGuardError, isAIGuardError } from "../errors.js";
import { getTaskProfile } from "../tasks/registry.js";
import type { AIGuard } from "../guard/ai-guard.js";
import type { ExecuteInput, ExecuteResult } from "../types.js";

const REPAIR_PROMPT_SUFFIX =
  "\n\nYour previous response was invalid. Reply with ONLY the required output format. No explanations.";

async function handleDomainRefusal(
  guard: AIGuard,
  error: AIGuardError,
): Promise<ExecuteResult | null> {
  if (error.code !== "DOMAIN_VIOLATION") return null;

  const refuseMessage = error.details?.refuseMessage;
  if (typeof refuseMessage !== "string") return null;

  return {
    output: refuseMessage,
    coinsConsumed: 0,
    balanceRemaining: await guard.getBalance(),
    validation: { valid: true, sanitizedOutput: refuseMessage },
    requestId: "",
    retried: false,
    refused: true,
  };
}

export async function executeRequest(
  guard: AIGuard,
  input: ExecuteInput,
): Promise<ExecuteResult> {
  const task = getTaskProfile(input.taskId);
  if (!task) {
    throw new AIGuardError("UNKNOWN_TASK", `Unknown task profile: ${input.taskId}`);
  }

  const imageCount = input.imageCount ?? 0;
  const estimatedInputTokens =
    input.estimatedInputTokens ?? Math.ceil(input.input.length / 4);

  let pre;
  try {
    pre = await guard.beforeRequest({
      taskId: input.taskId,
      estimatedInputTokens,
      imageCount,
      modelTier: input.modelTier,
      input: input.input,
      domainId: input.domainId,
    });
  } catch (error) {
    if (isAIGuardError(error)) {
      const refused = await handleDomainRefusal(guard, error);
      if (refused) return refused;
    }
    throw error;
  }

  let result = await input.invoke(pre.constraints);
  let retried = false;

  try {
    const post = await guard.afterRequest({
      requestId: pre.requestId,
      taskId: input.taskId,
      input: input.input,
      output: result.text,
      usage: result.usage,
      modelTier: input.modelTier,
      domainId: input.domainId ?? pre.constraints.domainId,
    });

    return {
      output: post.output,
      coinsConsumed: post.coinsConsumed,
      balanceRemaining: post.balanceRemaining,
      validation: post.validation,
      requestId: pre.requestId,
      retried,
    };
  } catch (error) {
    if (
      error instanceof AIGuardError &&
      error.code === "TASK_VALIDATION_FAILED" &&
      task.allowRetry
    ) {
      retried = true;
      const retryPre = await guard.beforeRequest({
        taskId: input.taskId,
        estimatedInputTokens: estimatedInputTokens + 50,
        imageCount,
        modelTier: input.modelTier,
        input: input.input,
        domainId: input.domainId,
      });

      result = await input.invoke({
        ...retryPre.constraints,
        systemPrompt: retryPre.constraints.systemPrompt + REPAIR_PROMPT_SUFFIX,
      });

      const post = await guard.afterRequest({
        requestId: retryPre.requestId,
        taskId: input.taskId,
        input: input.input,
        output: result.text,
        usage: result.usage,
        modelTier: input.modelTier,
        domainId: input.domainId ?? retryPre.constraints.domainId,
      });

      return {
        output: post.output,
        coinsConsumed: post.coinsConsumed,
        balanceRemaining: post.balanceRemaining,
        validation: post.validation,
        requestId: retryPre.requestId,
        retried,
      };
    }

    throw error;
  }
}
