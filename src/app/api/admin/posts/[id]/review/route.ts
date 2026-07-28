import { requireAdmin } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { ApiError, apiSuccess, withApi } from "@/lib/errors";
import { awardPoints } from "@/lib/points";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, readJson } from "@/lib/request";
import { reviewSchema } from "@/lib/validation";
import { NextRequest } from "next/server";

type Context = { params: Promise<{ id: string }> };

export const POST = withApi(async (request: NextRequest, context: Context) => {
  assertSameOrigin(request);
  enforceRateLimit(request, "admin:review", 60);
  const admin = await requireAdmin(request);
  const input = reviewSchema.parse(await readJson(request));
  const { id } = await context.params;

  const result = await withTransaction(async (client) => {
    const selected = await client.query<{
      id: string;
      author_id: string;
      status: string;
    }>(
      `SELECT id, author_id, status
         FROM posts
        WHERE (id::text = $1 OR slug = $1 OR external_id = $1)
        FOR UPDATE`,
      [id],
    );
    const post = selected.rows[0];
    if (!post) throw new ApiError(404, "NOT_FOUND", "未找到待审核投稿。");
    if (!["pending", "changes_requested"].includes(post.status)) {
      throw new ApiError(
        409,
        "CONFLICT",
        "该帖子当前状态不允许执行这项审核操作。",
        { currentStatus: post.status },
      );
    }

    const nextStatus =
      input.action === "approve"
        ? "published"
        : input.action === "reject"
          ? "rejected"
          : "changes_requested";
    await client.query(
      `UPDATE posts
          SET status = $2,
              expires_at = COALESCE($3, expires_at),
              published_at = CASE
                WHEN $2 = 'published' THEN COALESCE(published_at, NOW())
                ELSE published_at
              END,
              updated_at = NOW()
        WHERE id = $1`,
      [post.id, nextStatus, input.expiresAt ?? null],
    );
    await client.query(
      `INSERT INTO moderation_events
        (post_id, actor_id, from_status, to_status, reason_code, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        post.id,
        admin.id,
        post.status,
        nextStatus,
        input.reasonCode,
        input.note,
      ],
    );

    if (nextStatus === "published") {
      await awardPoints(client, {
        userId: post.author_id,
        eventType: "post_approved",
        points: 20,
        referenceType: "post",
        referenceId: post.id,
        idempotencyKey: `post-approved:${post.id}`,
      });
    }
    return { id: post.id, status: nextStatus };
  });

  return apiSuccess({
    post: result,
    message:
      input.action === "approve"
        ? "投稿已发布，贡献积分已通过幂等事件发放。"
        : "审核决定已记录。",
  });
});
