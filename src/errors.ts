export type AIGuardErrorCode =
  | "INSUFFICIENT_COINS"
  | "INPUT_TOKEN_LIMIT"
  | "OUTPUT_TOKEN_LIMIT"
  | "CHAT_TOKEN_LIMIT"
  | "IMAGE_LIMIT"
  | "RATE_LIMIT"
  | "TASK_VALIDATION_FAILED"
  | "UNKNOWN_TASK"
  | "TASK_NOT_ALLOWED"
  | "DOMAIN_VIOLATION"
  | "INVALID_REQUEST"
  | "GRACE_SLOT_NOT_FOUND";

export class AIGuardError extends Error {
  readonly code: AIGuardErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AIGuardErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AIGuardError";
    this.code = code;
    this.details = details;
  }
}

export function isAIGuardError(error: unknown): error is AIGuardError {
  return error instanceof AIGuardError;
}
