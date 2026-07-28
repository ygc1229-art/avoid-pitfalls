import { describe, expect, it } from "vitest";
import {
  createPostSchema,
  feedbackSchema,
  postQuerySchema,
  registerSchema,
} from "./validation";

describe("public query validation", () => {
  it("accepts all three official card types", () => {
    for (const cardType of [
      "experience",
      "rule_update",
      "action_checklist",
    ] as const) {
      expect(postQuerySchema.parse({ cardType }).cardType).toBe(cardType);
    }
  });
});

describe("write validation", () => {
  it("requires explicit registration terms consent", () => {
    const result = registerSchema.safeParse({
      email: "person@example.com",
      password: "strong-pass-123",
      displayName: "路标用户",
      acceptedTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a vague post before it reaches moderation", () => {
    expect(
      createPostSchema.safeParse({
        title: "踩坑了",
        summary: "不好",
        body: "太坑了",
        primaryAction: "注意",
        condition: "所有人",
        domain: "租房",
        categoryCode: "H1",
        countryRegionCode: "CN",
        riskLevel: "U2",
        tags: [],
        evidence: [],
        consentToPublish: true,
      }).success,
    ).toBe(false);
  });

  it("structures disagreement instead of treating it as a truth vote", () => {
    const value = feedbackSchema.parse({
      type: "outdated",
      reason: "该地区主管机关已在本月发布新规则，需要重新核对。",
    });
    expect(value.type).toBe("outdated");
  });
});
