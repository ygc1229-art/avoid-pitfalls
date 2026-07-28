import { requireUser } from "@/lib/auth";
import { apiSuccess, withApi } from "@/lib/errors";
import { createFeedback } from "@/lib/posts";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, readJson } from "@/lib/request";
import { feedbackSchema } from "@/lib/validation";
import { NextRequest } from "next/server";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi(async (request: NextRequest, context: Context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "feedback:create", 10, 60 * 60_000);
  const user = await requireUser(request);
  const input = feedbackSchema.parse(await readJson(request));
  const { id } = await context.params;
  return apiSuccess(await createFeedback(user.id, id, input), 201);
});
