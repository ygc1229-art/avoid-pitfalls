import { promises as fs } from "node:fs";
import path from "node:path";
import { ApiError } from "./errors";

export type GoldSample = {
  sample_id: string;
  domain: string;
  category: string;
  primary_category_code: string;
  title: string;
  card_type: string;
  knowledge_identity: string;
  source_tier: string;
  u: string;
  m: string;
  impact_level_u: string;
  moderation_risk_m: string;
  publishability: string;
  source_checked_at: string;
  source_urls: string[];
  source_organization: string;
  country_region_code: string;
  primary_action: string;
  review_state: string;
  reason_codes: string[];
  final_score: number;
  final_status: string;
};

let cache: GoldSample[] | undefined;

async function samples() {
  if (cache) return cache;
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "gold-samples.jsonl",
  );
  const content = await fs.readFile(filePath, "utf8");
  cache = content
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoldSample);
  return cache;
}

function mapSample(sample: GoldSample) {
  return {
    id: sample.sample_id,
    slug: sample.sample_id.toLowerCase(),
    title: sample.title,
    summary: sample.publishability,
    primaryAction: sample.primary_action,
    domain: sample.domain,
    categoryCode: sample.primary_category_code,
    countryRegionCode: sample.country_region_code,
    riskLevel: sample.impact_level_u,
    moderationRisk: sample.moderation_risk_m,
    cardType: sample.card_type,
    knowledgeIdentity: sample.knowledge_identity,
    sourceTier: sample.source_tier,
    sourceOrganizations: sample.source_organization
      .split("；")
      .filter(Boolean),
    sourceUrls: sample.source_urls,
    sourceCheckedAt: sample.source_checked_at,
    score: sample.final_score,
    status: "published",
    author: {
      displayName: "避坑指南系统编辑部",
      role: "system",
    },
    isFirsthand: false,
    fallback: true,
  };
}

export async function fallbackPosts(input: {
  q?: string;
  domain?: string;
  category?: string;
  region?: string;
  risk?: string;
  cardType?: "experience" | "action_checklist" | "rule_update";
  sort: "newest" | "score" | "risk";
  page: number;
  limit: number;
}) {
  const queryText = input.q?.toLocaleLowerCase("zh-CN");
  let filtered = (await samples()).filter((sample) => {
    const searchable = [
      sample.title,
      sample.publishability,
      sample.primary_action,
      sample.domain,
      sample.source_organization,
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN");
    return (
      (!queryText || searchable.includes(queryText)) &&
      (!input.domain || sample.domain === input.domain) &&
      (!input.category ||
        sample.primary_category_code === input.category ||
        sample.category === input.category) &&
      (!input.region || sample.country_region_code === input.region) &&
      (!input.risk || sample.impact_level_u === input.risk) &&
      (!input.cardType || sample.card_type === input.cardType)
    );
  });

  if (input.sort === "score") {
    filtered = filtered.sort((a, b) => b.final_score - a.final_score);
  } else if (input.sort === "risk") {
    filtered = filtered.sort((a, b) =>
      b.impact_level_u.localeCompare(a.impact_level_u),
    );
  }

  const start = (input.page - 1) * input.limit;
  return {
    items: filtered.slice(start, start + input.limit).map(mapSample),
    pagination: {
      page: input.page,
      limit: input.limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / input.limit),
    },
    dataMode: "file-fallback" as const,
  };
}

export async function fallbackPost(idOrSlug: string) {
  const found = (await samples()).find(
    (sample) =>
      sample.sample_id === idOrSlug ||
      sample.sample_id.toLowerCase() === idOrSlug.toLowerCase(),
  );
  if (!found) throw new ApiError(404, "NOT_FOUND", "未找到这条避坑内容。");
  return { ...mapSample(found), comments: [], dataMode: "file-fallback" };
}
