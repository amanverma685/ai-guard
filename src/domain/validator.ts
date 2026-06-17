import type { ValidationResult } from "../types.js";

export type DomainProfile = {
  id: string;
  name: string;
  description: string;
  /** Prepended to the task system prompt to scope the model */
  systemPrompt: string;
  /** If set, input must contain at least one keyword (case-insensitive) */
  allowedKeywords?: string[];
  /** Input containing any of these is rejected before the LLM call */
  forbiddenKeywords?: string[];
  /** Patterns that indicate an off-domain model response */
  forbiddenOutputPatterns?: RegExp[];
  /** Returned to the user when input is off-domain (no LLM call, no coins spent) */
  refuseMessage: string;
  /** Custom input gate — return invalid to block before LLM */
  inputValidator?: (input: string) => ValidationResult;
  /** Custom output gate — return invalid to reject response */
  outputValidator?: (output: string, input: string) => ValidationResult;
  /**
   * When true (default if allowedKeywords is set), input must match at least one
   * allowed keyword. When false, allowedKeywords are advisory only (prompt-only).
   */
  strictKeywordCheck?: boolean;
};

export function createDomainProfile(
  profile: DomainProfile,
): DomainProfile {
  return profile;
}

function containsKeyword(text: string, keywords: string[]): string | undefined {
  const lower = text.toLowerCase();
  return keywords.find((kw) => lower.includes(kw.toLowerCase()));
}

export function validateDomainInput(
  input: string,
  domain: DomainProfile,
): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, reason: "Input is empty" };
  }

  if (domain.inputValidator) {
    const custom = domain.inputValidator(trimmed);
    if (!custom.valid) return custom;
  }

  if (domain.forbiddenKeywords?.length) {
    const hit = containsKeyword(trimmed, domain.forbiddenKeywords);
    if (hit) {
      return {
        valid: false,
        reason: `Input contains off-domain topic: "${hit}"`,
      };
    }
  }

  const strict =
    domain.strictKeywordCheck ?? Boolean(domain.allowedKeywords?.length);

  if (strict && domain.allowedKeywords?.length) {
    const matched = containsKeyword(trimmed, domain.allowedKeywords);
    if (!matched) {
      return {
        valid: false,
        reason: "Input does not match the allowed domain topics",
      };
    }
  }

  return { valid: true };
}

export function validateDomainOutput(
  output: string,
  input: string,
  domain: DomainProfile,
): ValidationResult {
  const trimmed = output.trim();

  if (domain.forbiddenOutputPatterns) {
    for (const pattern of domain.forbiddenOutputPatterns) {
      if (pattern.test(trimmed)) {
        return {
          valid: false,
          reason: `Output matches off-domain pattern: ${pattern.source}`,
        };
      }
    }
  }

  if (domain.outputValidator) {
    return domain.outputValidator(trimmed, input);
  }

  if (domain.forbiddenKeywords?.length) {
    const hit = containsKeyword(trimmed, domain.forbiddenKeywords);
    if (hit) {
      return {
        valid: false,
        reason: `Output references off-domain topic: "${hit}"`,
      };
    }
  }

  return { valid: true, sanitizedOutput: trimmed };
}

export function buildDomainSystemPrompt(
  domain: DomainProfile,
  taskPrompt: string,
): string {
  return [
    domain.systemPrompt,
    `Domain: ${domain.name}. Scope: ${domain.description}`,
    "If the user question is outside this domain, respond ONLY with:",
    `"${domain.refuseMessage}"`,
    "",
    taskPrompt,
  ].join("\n");
}
