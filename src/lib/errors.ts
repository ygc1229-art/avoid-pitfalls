import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DATABASE_UNAVAILABLE"
  | "CSRF_REJECTED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class DatabaseUnavailableError extends ApiError {
  constructor(message = "数据库暂时不可用，写入未保存，请稍后重试。") {
    super(503, "DATABASE_UNAVAILABLE", message, undefined, true);
    this.name = "DatabaseUnavailableError";
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiFailure(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "提交内容未通过校验。",
          details: error.flatten(),
          retryable: false,
        },
      },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          retryable: error.retryable,
        },
      },
      {
        status: error.status,
        headers:
          error.code === "RATE_LIMITED"
            ? { "Retry-After": "60" }
            : undefined,
      },
    );
  }

  console.error("[api] unhandled error", error);
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "服务暂时无法完成请求。",
        retryable: true,
      },
    },
    { status: 500 },
  );
}

export function withApi<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiFailure(error);
    }
  };
}
