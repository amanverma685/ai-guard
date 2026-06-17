import type { TaskProfile } from "../types.js";
import { validateSummary, validateTitle } from "./validator.js";

const EXPLANATION_PATTERNS: RegExp[] = [
  /^as an ai/i,
  /^i hope this helps/i,
  /^let me know/i,
  /^sure[,!]/i,
  /^certainly/i,
];

export const TASK_PROFILES: Record<string, TaskProfile> = {
  generateTitle: {
    id: "generateTitle",
    systemPrompt:
      "You generate a single title from the given context. Return ONLY the title text. No quotes, labels, explanations, or extra punctuation. Maximum 80 characters.",
    maxOutputTokens: 30,
    outputFormat: "text",
    validator: validateTitle,
    forbiddenPatterns: [
      /^#+\s/m,
      /^\*\*/,
      /^title:\s*/i,
      ...EXPLANATION_PATTERNS,
    ],
    allowRetry: true,
  },
  summarize: {
    id: "summarize",
    systemPrompt:
      "Summarize ONLY the provided context. Return a concise summary without preamble, meta-commentary, or information not present in the input.",
    maxOutputTokens: 512,
    outputFormat: "text",
    validator: validateSummary,
    forbiddenPatterns: EXPLANATION_PATTERNS,
    allowRetry: true,
  },
  generalChat: {
    id: "generalChat",
    systemPrompt:
      "Answer based only on the provided context and user message. Do not invent facts. If the context is insufficient, say so briefly.",
    maxOutputTokens: 2048,
    outputFormat: "text",
    allowRetry: false,
  },
};

export function getTaskProfile(taskId: string): TaskProfile | undefined {
  return TASK_PROFILES[taskId];
}

export function registerTaskProfile(profile: TaskProfile): void {
  TASK_PROFILES[profile.id] = profile;
}

export function isTaskAllowed(
  taskId: string,
  allowed: string[] | "*",
): boolean {
  if (allowed === "*") return true;
  return allowed.includes(taskId);
}
