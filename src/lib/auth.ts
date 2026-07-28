import { NextRequest, NextResponse } from "next/server";
import { query } from "./db";
import { ApiError } from "./errors";
import { createSessionToken, hashSessionToken } from "./security";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "moderator" | "admin" | "system";
  points: number;
  level: number;
};

function cookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Host-bkg_session"
    : "bkg_session";
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  await query(
    `INSERT INTO sessions
       (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3 * INTERVAL '1 second'))`,
    [userId, tokenHash, SESSION_TTL_SECONDS],
  );
  return token;
}

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(cookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function destroySession(request: NextRequest) {
  const token = request.cookies.get(cookieName())?.value;
  if (!token) return;
  await query("DELETE FROM sessions WHERE token_hash = $1", [
    hashSessionToken(token),
  ]);
}

export async function getCurrentUser(
  request: NextRequest,
): Promise<SessionUser | null> {
  const token = request.cookies.get(cookieName())?.value;
  if (!token) return null;

  const result = await query<{
    id: string;
    email: string;
    display_name: string;
    role: SessionUser["role"];
    points: number;
    level: number;
  }>(
    `SELECT u.id, u.email, u.display_name, u.role, u.points, u.level
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > NOW()
        AND u.status = 'active'
      LIMIT 1`,
    [hashSessionToken(token)],
  );

  const user = result.rows[0];
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    points: user.points,
    level: user.level,
  };
}

export async function requireUser(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new ApiError(401, "AUTH_REQUIRED", "请先登录后再进行此操作。");
  }
  return user;
}

export async function requireAdmin(request: NextRequest) {
  const user = await requireUser(request);
  if (!["admin", "moderator"].includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN", "该操作需要审核员权限。");
  }
  return user;
}
