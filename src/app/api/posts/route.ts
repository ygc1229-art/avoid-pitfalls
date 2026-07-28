import { requireUser } from "@/lib/auth";
import { DatabaseUnavailableError, apiSuccess, withApi } from "@/lib/errors";
import { fallbackPosts } from "@/lib/fallback";
import { createPendingPost, listPublishedPosts } from "@/lib/posts";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, readJson } from "@/lib/request";
import { createPostSchema, postQuerySchema } from "@/lib/validation";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request: NextRequest) => {
  enforceRateLimit(request, "posts:read", 120);
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const input = postQuerySchema.parse(params);
  try {
    return apiSuccess(await listPublishedPosts(input));
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    return apiSuccess(await fallbackPosts(input));
  }
});

export const POST = withApi(async (request: NextRequest) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "posts:create", 5, 60 * 60_000);
  const user = await requireUser(request);
  const input = createPostSchema.parse(await readJson(request));
  const post = await createPendingPost(user.id, input);
  return apiSuccess(
    {
      post,
      status: "pending",
      message: "投稿已进入审核队列；审核通过前不会公开展示。",
    },
    201,
  );
});
