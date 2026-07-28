import { createSession, setSessionCookie } from "@/lib/auth";
import { query } from "@/lib/db";
import { ApiError, apiSuccess, withApi } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, readJson } from "@/lib/request";
import { hashPassword, normalizeEmail } from "@/lib/security";
import { registerSchema } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export const POST = withApi(async (request: NextRequest) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "auth:register", 5, 15 * 60_000);
  const input = registerSchema.parse(await readJson(request));
  const email = normalizeEmail(input.email);
  const existing = await query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (existing.rowCount) {
    throw new ApiError(409, "CONFLICT", "该邮箱已经注册。");
  }

  const passwordHash = await hashPassword(input.password);
  let created;
  try {
    created = await query<{
      id: string;
      display_name: string;
      role: string;
      points: number;
      level: number;
    }>(
      `INSERT INTO users
        (email, password_hash, display_name, role, account_kind,
         age_confirmed, terms_accepted_at)
       VALUES ($1, $2, $3, 'user', 'person', $4, NOW())
       RETURNING id, display_name, role, points, level`,
      [email, passwordHash, input.displayName, input.ageConfirmed],
    );
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    if (code === "23505")
      throw new ApiError(409, "CONFLICT", "该邮箱已经注册。");
    throw error;
  }

  const user = created.rows[0];
  const token = await createSession(user.id);
  const response = apiSuccess(
    {
      user: {
        id: user.id,
        email,
        displayName: user.display_name,
        role: user.role,
        points: user.points,
        level: user.level,
      },
    },
    201,
  ) as NextResponse;
  setSessionCookie(response, token);
  return response;
});
