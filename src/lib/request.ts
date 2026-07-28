import { NextRequest } from "next/server";
import { ApiError } from "./errors";

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin && new URL(origin).origin !== request.nextUrl.origin) {
    throw new ApiError(403, "CSRF_REJECTED", "跨站写入请求已被拒绝。");
  }
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new ApiError(403, "CSRF_REJECTED", "跨站写入请求已被拒绝。");
  }
}

export async function readJson(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "请求必须使用 application/json。",
    );
  }
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", "JSON 格式无效。");
  }
}
