import { DatabaseUnavailableError, apiSuccess, withApi } from "@/lib/errors";
import { fallbackPost } from "@/lib/fallback";
import { getPublishedPost } from "@/lib/posts";
import { enforceRateLimit } from "@/lib/rate-limit";
import { NextRequest } from "next/server";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const GET = withApi(async (request: NextRequest, context: Context) => {
  enforceRateLimit(request, "posts:detail", 120);
  const { id } = await context.params;
  try {
    return apiSuccess(await getPublishedPost(id));
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    return apiSuccess(await fallbackPost(id));
  }
});
