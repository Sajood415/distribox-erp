export class AppError extends Error {
  constructor(message, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed") {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class ConcurrencyError extends AppError {
  constructor(message = "Record was modified by another user") {
    super(message, "CONCURRENCY_ERROR");
    this.name = "ConcurrencyError";
  }
}

export function toErrorResponse(error) {
  if (error instanceof AppError) {
    return { success: false, error: error.message, code: error.code };
  }
  return { success: false, error: error.message || "Unexpected error", code: "APP_ERROR" };
}
