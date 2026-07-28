import { PoolClient } from "pg";
import { query, withTransaction } from "./db";
import { ApiError } from "./errors";
import { awardPoints } from "./points";
import { createId } from "./security";
import type {
  createPostSchema,
  feedbackSchema,
  postQuerySchema,
} from "./validation";
import type { z } from "zod";

type PostQuery = z.infer<typeof postQuerySchema>;
type NewPost = z.infer<typeof createPostSchema>;
type Feedback = z.infer<typeof feedbackSchema>;

type PostRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body?: string;
  primary_action: string;
  condition_text?: string;
  domain: string;
  category_code: string;
  country_region_code: string;
  risk_level: string;
  moderation_risk: string;
  card_type: string;
  knowledge_identity: string;
  source_tier: string | null;
  source_checked_at: string | null;
  status: string;
  score: number;
  is_firsthand: boolean;
  happened_at: string | null;
  expires_at: string | null;
  published_at: string | null;
  created_at: string;
  author_id: string;
  author_name: string;
  author_role: string;
  tags: string[] | null;
  favorite_count: number;
  comment_count: number;
  report_count: number;
  source_urls?: string[] | null;
  source_organizations?: string[] | null;
};

function mapPost(row: PostRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    primaryAction: row.primary_action,
    condition: row.condition_text,
    domain: row.domain,
    categoryCode: row.category_code,
    countryRegionCode: row.country_region_code,
    riskLevel: row.risk_level,
    moderationRisk: row.moderation_risk,
    cardType: row.card_type,
    knowledgeIdentity: row.knowledge_identity,
    sourceTier: row.source_tier,
    sourceCheckedAt: row.source_checked_at,
    status: row.status,
    score: row.score,
    isFirsthand: row.is_firsthand,
    happenedAt: row.happened_at,
    expiresAt: row.expires_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    tags: row.tags ?? [],
    sourceUrls: row.source_urls ?? [],
    sourceOrganizations: row.source_organizations ?? [],
    counts: {
      favorites: Number(row.favorite_count),
      comments: Number(row.comment_count),
      openFeedback: Number(row.report_count),
    },
    author: {
      id: row.author_id,
      displayName: row.author_name,
      role: row.author_role,
    },
  };
}

const postSelect = `
  SELECT p.*,
         u.display_name AS author_name,
         u.role AS author_role,
         COALESCE(t.tags, ARRAY[]::text[]) AS tags,
         (SELECT COUNT(*)::int FROM favorites f WHERE f.post_id = p.id)
           AS favorite_count,
         (SELECT COUNT(*)::int FROM comments c
           WHERE c.post_id = p.id AND c.status = 'visible') AS comment_count,
         (SELECT COUNT(*)::int FROM reports r
           WHERE r.post_id = p.id AND r.status = 'open') AS report_count,
         COALESCE(e.source_urls, ARRAY[]::text[]) AS source_urls,
         COALESCE(e.source_organizations, ARRAY[]::text[])
           AS source_organizations
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(tag.name ORDER BY tag.name) AS tags
        FROM post_tags pt JOIN tags tag ON tag.id = pt.tag_id
       WHERE pt.post_id = p.id
    ) t ON TRUE
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(se.source_url ORDER BY se.created_at)
               FILTER (WHERE se.source_url IS NOT NULL) AS source_urls,
             ARRAY_AGG(DISTINCT se.source_organization)
               FILTER (WHERE se.source_organization IS NOT NULL)
               AS source_organizations
        FROM source_evidence se
       WHERE se.post_id = p.id AND se.visibility = 'public'
    ) e ON TRUE
`;

export async function listPublishedPosts(input: PostQuery) {
  const values: unknown[] = [];
  const filters = ["p.status = 'published'"];
  const add = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (input.q) {
    const parameter = add(`%${input.q}%`);
    filters.push(
      `(p.title ILIKE ${parameter} OR p.summary ILIKE ${parameter} OR ` +
        `p.primary_action ILIKE ${parameter})`,
    );
  }
  if (input.domain) filters.push(`p.domain = ${add(input.domain)}`);
  if (input.category)
    filters.push(`p.category_code = ${add(input.category)}`);
  if (input.region)
    filters.push(`p.country_region_code = ${add(input.region)}`);
  if (input.risk) filters.push(`p.risk_level = ${add(input.risk)}`);
  if (input.cardType)
    filters.push(`p.card_type = ${add(input.cardType)}`);

  const order =
    input.sort === "newest"
      ? "p.published_at DESC NULLS LAST"
      : input.sort === "risk"
        ? "p.risk_level DESC, p.score DESC"
        : "p.score DESC, p.published_at DESC NULLS LAST";
  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM posts p WHERE ${filters.join(" AND ")}`,
    values,
  );
  const offset = (input.page - 1) * input.limit;
  const limitParameter = add(input.limit);
  const offsetParameter = add(offset);
  const result = await query<PostRow>(
    `${postSelect}
     WHERE ${filters.join(" AND ")}
     ORDER BY ${order}
     LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
    values,
  );
  const total = Number(countResult.rows[0]?.total ?? 0);
  return {
    items: result.rows.map(mapPost),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.ceil(total / input.limit),
    },
    dataMode: "postgres" as const,
  };
}

export async function getPublishedPost(idOrSlug: string) {
  const result = await query<PostRow>(
    `${postSelect}
      WHERE (p.id::text = $1 OR p.slug = $1 OR p.external_id = $1)
        AND p.status = 'published'
      LIMIT 1`,
    [idOrSlug],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(404, "NOT_FOUND", "未找到这条避坑内容。");
  return { ...mapPost(row), dataMode: "postgres" as const };
}

async function attachTags(
  client: PoolClient,
  postId: string,
  tags: string[],
) {
  for (const name of [...new Set(tags.map((tag) => tag.toLowerCase()))]) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO tags (name, slug)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name, name.replace(/\s+/g, "-")],
    );
    await client.query(
      `INSERT INTO post_tags (post_id, tag_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, result.rows[0].id],
    );
  }
}

export async function createPendingPost(userId: string, input: NewPost) {
  return withTransaction(async (client) => {
    const id = createId();
    const slug = `${input.domain}-${id.slice(0, 8)}`.toLowerCase();
    const result = await client.query<{ id: string; slug: string }>(
      `INSERT INTO posts
        (id, slug, author_id, title, summary, body, primary_action,
         condition_text, domain, category_code, country_region_code,
         risk_level, moderation_risk, card_type, knowledge_identity,
         is_firsthand, happened_at, expires_at, status)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         'M2', $13, 'user_submission', TRUE, $14, $15, 'pending')
       RETURNING id, slug`,
      [
        id,
        slug,
        userId,
        input.title,
        input.summary,
        input.body,
        input.primaryAction,
        input.condition,
        input.domain,
        input.categoryCode,
        input.countryRegionCode,
        input.riskLevel,
        input.cardType,
        input.happenedAt ?? null,
        input.expiresAt ?? null,
      ],
    );

    await client.query(
      `INSERT INTO regions (code, name)
       VALUES ($1, $1) ON CONFLICT (code) DO NOTHING`,
      [input.countryRegionCode],
    );
    await client.query(
      `INSERT INTO post_regions (post_id, region_code, relation_type)
       VALUES ($1, $2, 'applies_to') ON CONFLICT DO NOTHING`,
      [id, input.countryRegionCode],
    );
    await attachTags(client, id, input.tags);

    for (const evidence of input.evidence) {
      await client.query(
        `INSERT INTO source_evidence
          (post_id, submitted_by, evidence_kind, source_url, description,
           occurred_at, visibility, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'reviewers_only', 'unverified')`,
        [
          id,
          userId,
          evidence.kind,
          evidence.url ?? null,
          evidence.description,
          evidence.occurredAt ?? null,
        ],
      );
    }
    await client.query(
      `INSERT INTO moderation_events
        (post_id, actor_id, from_status, to_status, reason_code, note)
       VALUES ($1, $2, 'draft', 'pending', 'SUBMITTED', '用户提交，等待审核')`,
      [id, userId],
    );
    return result.rows[0];
  });
}

export async function listComments(postIdOrSlug: string) {
  const result = await query<{
    id: string;
    parent_id: string | null;
    body: string;
    created_at: string;
    author_id: string;
    author_name: string;
    author_level: number;
  }>(
    `SELECT c.id, c.parent_id, c.body, c.created_at,
            u.id AS author_id, u.display_name AS author_name,
            u.level AS author_level
       FROM comments c
       JOIN users u ON u.id = c.author_id
       JOIN posts p ON p.id = c.post_id
      WHERE (p.id::text = $1 OR p.slug = $1 OR p.external_id = $1)
        AND p.status = 'published'
        AND c.status = 'visible'
      ORDER BY c.created_at ASC
      LIMIT 500`,
    [postIdOrSlug],
  );
  return result.rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      displayName: row.author_name,
      level: row.author_level,
    },
  }));
}

export async function createComment(
  userId: string,
  postIdOrSlug: string,
  input: { body: string; parentId?: string },
) {
  return withTransaction(async (client) => {
    const post = await client.query<{ id: string }>(
      `SELECT id FROM posts
        WHERE (id::text = $1 OR slug = $1 OR external_id = $1)
          AND status = 'published'`,
      [postIdOrSlug],
    );
    if (!post.rows[0])
      throw new ApiError(404, "NOT_FOUND", "未找到这条避坑内容。");

    if (input.parentId) {
      const parent = await client.query(
        `SELECT 1 FROM comments WHERE id = $1 AND post_id = $2`,
        [input.parentId, post.rows[0].id],
      );
      if (!parent.rowCount)
        throw new ApiError(400, "VALIDATION_ERROR", "回复目标无效。");
    }

    const result = await client.query<{
      id: string;
      body: string;
      created_at: string;
    }>(
      `INSERT INTO comments (post_id, author_id, parent_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, body, created_at`,
      [post.rows[0].id, userId, input.parentId ?? null, input.body],
    );
    await awardPoints(client, {
      userId,
      eventType: "comment_created",
      points: 1,
      referenceType: "comment",
      referenceId: result.rows[0].id,
      idempotencyKey: `comment:${result.rows[0].id}`,
    });
    return result.rows[0];
  });
}

export async function setFavorite(
  userId: string,
  postIdOrSlug: string,
  favorite: boolean,
) {
  const result = await query<{ id: string }>(
    `SELECT id FROM posts
      WHERE (id::text = $1 OR slug = $1 OR external_id = $1)
        AND status = 'published'`,
    [postIdOrSlug],
  );
  const post = result.rows[0];
  if (!post) throw new ApiError(404, "NOT_FOUND", "未找到这条避坑内容。");

  if (favorite) {
    await query(
      `INSERT INTO favorites (user_id, post_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, post.id],
    );
  } else {
    await query("DELETE FROM favorites WHERE user_id = $1 AND post_id = $2", [
      userId,
      post.id,
    ]);
  }
  return { favorited: favorite };
}

export async function createFeedback(
  userId: string,
  postIdOrSlug: string,
  input: Feedback,
) {
  const result = await query<{ id: string }>(
    `INSERT INTO reports
      (post_id, reporter_id, report_type, reason, evidence_url,
       suggested_correction)
     SELECT p.id, $2, $3, $4, $5, $6
       FROM posts p
      WHERE (p.id::text = $1 OR p.slug = $1 OR p.external_id = $1)
        AND p.status = 'published'
     RETURNING id`,
    [
      postIdOrSlug,
      userId,
      input.type,
      input.reason,
      input.evidenceUrl ?? null,
      input.suggestedCorrection ?? null,
    ],
  );
  if (!result.rows[0])
    throw new ApiError(404, "NOT_FOUND", "未找到这条避坑内容。");
  return {
    id: result.rows[0].id,
    status: "open",
    message: "反馈已进入人工审核队列，帖子不会因单次反馈被自动判定真伪。",
  };
}
