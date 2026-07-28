import {
  clearSessionCookie,
  destroySession,
} from "@/lib/auth";
import { apiFailure, apiSuccess } from "@/lib/errors";
import { assertSameOrigin } from "@/lib/request";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await destroySession(request);
    const response = apiSuccess({ loggedOut: true }) as NextResponse;
    clearSessionCookie(response);
    return response;
  } catch (error) {
    const response = apiFailure(error);
    clearSessionCookie(response);
    return response;
  }
}
