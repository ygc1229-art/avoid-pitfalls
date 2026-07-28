import { getCurrentUser } from "@/lib/auth";
import { apiSuccess, withApi } from "@/lib/errors";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request: NextRequest) => {
  return apiSuccess({ user: await getCurrentUser(request) });
});
