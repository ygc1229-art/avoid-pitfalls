import { requireUser } from "@/lib/auth";
import { apiSuccess, withApi } from "@/lib/errors";
import { setFavorite } from "@/lib/posts";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/request";
import { NextRequest } from "next/server";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi(async (request: NextRequest, context: Context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "favorite:write", 60);
  const user = await requireUser(request);
  const { id } = await context.params;
  return apiSuccess(await setFavorite(user.id, id, true));
});

export const DELETE = withApi(
  async (request: NextRequest, context: Context) => {
    assertSameOrigin(request);
    enforceRateLimit(request, "favorite:write", 60);
    const user = await requireUser(request);
    const { id } = await context.params;
    return apiSuccess(await setFavorite(user.id, id, false));
  },
);
