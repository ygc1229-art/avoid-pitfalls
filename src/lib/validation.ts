import { z } from "zod";

const email = z.string().trim().email().max(254);
const password = z
  .string()
  .min(10, "密码至少需要 10 个字符")
  .max(128)
  .regex(/[A-Za-z]/, "密码需要包含字母")
  .regex(/[0-9]/, "密码需要包含数字");

export const registerSchema = z.object({
  email,
  password,
  displayName: z.string().trim().min(2).max(40),
  acceptedTerms: z.literal(true),
  ageConfirmed: z.boolean().default(false),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const postQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  domain: z.string().trim().max(40).optional(),
  category: z.string().trim().max(20).optional(),
  region: z.string().trim().max(24).optional(),
  risk: z.enum(["U1", "U2", "U3", "U4"]).optional(),
  cardType: z
    .enum(["experience", "action_checklist", "rule_update"])
    .optional(),
  sort: z.enum(["newest", "score", "risk"]).default("score"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createPostSchema = z.object({
  title: z.string().trim().min(8).max(120),
  summary: z.string().trim().min(20).max(300),
  body: z.string().trim().min(50).max(12_000),
  primaryAction: z.string().trim().min(8).max(300),
  condition: z.string().trim().min(8).max(500),
  domain: z.string().trim().min(2).max(40),
  categoryCode: z.string().trim().min(1).max(20),
  countryRegionCode: z.string().trim().min(2).max(24),
  riskLevel: z.enum(["U1", "U2", "U3", "U4"]),
  cardType: z
    .enum(["experience", "action_checklist", "rule_update"])
    .default("experience"),
  happenedAt: z.coerce.date().max(new Date()).optional(),
  expiresAt: z.coerce.date().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  evidence: z
    .array(
      z.object({
        kind: z.enum([
          "official_source",
          "contract",
          "receipt",
          "conversation",
          "photo",
          "other",
        ]),
        url: z.string().url().max(2_000).optional(),
        description: z.string().trim().min(2).max(300),
        occurredAt: z.coerce.date().optional(),
      }),
    )
    .max(10)
    .default([]),
  consentToPublish: z.literal(true),
});

export const commentSchema = z.object({
  body: z.string().trim().min(2).max(2_000),
  parentId: z.string().uuid().optional(),
});

export const feedbackSchema = z.object({
  type: z.enum([
    "denial",
    "outdated",
    "missing_context",
    "rule_changed",
  ]),
  reason: z.string().trim().min(10).max(2_000),
  evidenceUrl: z.string().url().max(2_000).optional(),
  suggestedCorrection: z.string().trim().max(2_000).optional(),
});

export const reviewSchema = z
  .object({
    action: z.enum(["approve", "reject", "request_changes"]),
    reasonCode: z.string().trim().min(3).max(40),
    note: z.string().trim().min(5).max(2_000),
    expiresAt: z.coerce.date().optional(),
  })
  .superRefine((value, context) => {
    if (value.action !== "approve" && value.note.length < 10) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: "拒绝或退回修改时必须提供充分理由。",
      });
    }
  });
