import { requireUser } from "@/lib/auth";
import { DatabaseUnavailableError, apiSuccess, withApi } from "@/lib/errors";
import { createComment, listComments } from "@/lib/posts";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, readJson } from "@/lib/request";
import { commentSchema } from "@/lib/validation";
import { NextRequest } from "next/server";

type Context = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export const GET = withApi(async (request: NextRequest, context: Context) => {
  enforceRateLimit(request, "comments:read", 120);
  const { id } = await context.params;
  try {
    return apiSuccess({
      items: await listComments(id),
      dataMode: "postgres",
    });
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    return apiSuccess({ items: [], dataMode: "file-fallback" });
  }
});

export const POST = withApi(async (request: NextRequest, context: Context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "comments:create", 20, 60 * 60_000);
  const user = await requireUser(request);
  const input = commentSchema.parse(await readJson(request));
  const { id } = await context.params;
  return apiSuccess(await createComment(user.id, id, input), 201);
});
