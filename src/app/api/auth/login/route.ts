import { createSession, setSessionCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { ApiError, apiSuccess, withApi } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, readJson } from "@/lib/request";
import { normalizeEmail, verifyPassword } from "@/lib/security";
import { loginSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export const POST = withApi(async (request: NextRequest) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "auth:login", 10, 15 * 60_000);
  const input = loginSchema.parse(await readJson(request));
  const email = normalizeEmail(input.email);
  const result = await query<{
    id: string;
    password_hash: string | null;
    display_name: string;
    role: string;
    points: number;
    level: number;
    status: string;
    account_kind: string;
  }>(
    `SELECT id, password_hash, display_name, role, points, level, status,
            account_kind
       FROM users WHERE email = $1 LIMIT 1`,
    [email],
  );
  const user = result.rows[0];
  const valid =
    user?.account_kind !== "system" &&
    user?.status === "active" &&
    (await verifyPassword(input.password, user?.password_hash ?? null));
  if (!valid) {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "邮箱或密码不正确。",
    );
  }

  const token = await createSession(user.id);
  const response = apiSuccess({
    user: {
      id: user.id,
      email,
      displayName: user.display_name,
      role: user.role,
      points: user.points,
      level: user.level,
    },
  }) as NextResponse;
  setSessionCookie(response, token);
  return response;
});
