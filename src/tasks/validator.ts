import type { ValidationResult } from "../types.js";

export function validateOutput(
  output: string,
  input: string,
  options: {
    forbiddenPatterns?: RegExp[];
    validator?: (output: string, input: string) => ValidationResult;
  },
): ValidationResult {
  const trimmed = output.trim();

  if (!trimmed) {
    return { valid: false, reason: "Output is empty" };
  }

  if (options.forbiddenPatterns) {
    for (const pattern of options.forbiddenPatterns) {
      if (pattern.test(trimmed)) {
        return {
          valid: false,
          reason: `Output matches forbidden pattern: ${pattern.source}`,
        };
      }
    }
  }

  if (options.validator) {
    return options.validator(trimmed, input);
  }

  return { valid: true, sanitizedOutput: trimmed };
}

export function stripQuotes(text: string): string {
  return text.replace(/^["'`]+|["'`]+$/g, "").trim();
}

export function validateTitle(output: string, _input: string): ValidationResult {
  const title = stripQuotes(output);

  if (title.length === 0) {
    return { valid: false, reason: "Title is empty" };
  }

  if (title.length > 80) {
    return { valid: false, reason: "Title exceeds 80 characters" };
  }

  if (title.includes("\n")) {
    return { valid: false, reason: "Title must be a single line" };
  }

  const explanationPatterns = [
    /^here(?:'s| is)/i,
    /^the title is/i,
    /^title:/i,
    /^i (?:would|think|suggest)/i,
  ];

  for (const pattern of explanationPatterns) {
    if (pattern.test(title)) {
      return { valid: false, reason: "Output contains explanation instead of title" };
    }
  }

  return { valid: true, sanitizedOutput: title };
}

export function validateSummary(output: string, input: string): ValidationResult {
  const summary = output.trim();

  if (summary.length === 0) {
    return { valid: false, reason: "Summary is empty" };
  }

  if (summary.length > Math.max(input.length, 500)) {
    return { valid: false, reason: "Summary is longer than expected" };
  }

  const offTopicPatterns = [
    /^as an ai/i,
    /^i cannot/i,
    /^i don't have/i,
    /^let me know if/i,
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(summary)) {
      return { valid: false, reason: "Output appears off-topic or meta" };
    }
  }

  return { valid: true, sanitizedOutput: summary };
}
