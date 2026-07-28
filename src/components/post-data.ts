export type CardType = "experience" | "rule_update" | "action_checklist";

export type Post = {
  id: string;
  slug?: string;
  title: string;
  domain: string;
  categoryCode: string;
  region: string;
  regionCode: string;
  risk: "低" | "中" | "高" | "较高";
  riskCode: "U1" | "U2" | "U3" | "U4";
  cardType: CardType;
  action: string;
  condition: string;
  sourceName: string;
  sourceUrl?: string;
  checkedAt: string;
  reviewState: string;
  score: number;
  favorites: number;
  comments: number;
  counters: number;
  summary?: string;
};

export const cardTypeLabels: Record<CardType, string> = {
  experience: "公开案例",
  rule_update: "规则更新",
  action_checklist: "行动清单",
};

export const featuredPosts: Post[] = [
  {
    id: "RENT-H4-ENG-004",
    title: "英格兰租房付款先核对“允许收取的项目”",
    domain: "租房",
    region: "英格兰",
    risk: "高",
    cardType: "rule_update",
    action: "让收款方逐项写明收费类别、金额公式和退还条件。",
    condition: "适用于英格兰私人租赁；其他地区规则不同。",
    sourceName: "GOV.UK",
    sourceUrl: "https://www.gov.uk/guidance/tenant-fees-act-2019-guidance-for-tenants",
    checkedAt: "2026-07-28",
    reviewState: "已核验",
    score: 95,
    categoryCode: "H4",
    regionCode: "GB-ENG",
    riskCode: "U4",
    favorites: 0,
    comments: 0,
    counters: 2,
  },
  {
    id: "JOB-J1-02",
    title: "发布化妆师助理招聘后转培训：官方案例",
    domain: "求职",
    region: "中国",
    risk: "高",
    cardType: "experience",
    action: "面试突然转培训时先停付，核对培训、招聘与用工主体。",
    condition: "官方公开案例摘要，不代表所有培训安排均有问题。",
    sourceName: "人力资源社会保障部",
    sourceUrl: "https://chrm.mohrss.gov.cn/",
    checkedAt: "2026-07-28",
    reviewState: "已核验",
    score: 94,
    categoryCode: "J1",
    regionCode: "CN",
    riskCode: "U4",
    favorites: 0,
    comments: 0,
    counters: 1,
  },
  {
    id: "RENT-H3-ENG-003",
    title: "看房时把“可见缺陷”和“必须交付的安全文件”分开检查",
    domain: "租房",
    region: "英格兰",
    risk: "较高",
    cardType: "action_checklist",
    action: "把现场测试项和必须取得的安全文件分成两栏。",
    condition: "适用于英格兰私人租赁，不泛化至整个英国。",
    sourceName: "GOV.UK",
    sourceUrl: "https://www.gov.uk/private-renting/your-landlords-safety-responsibilities",
    checkedAt: "2026-07-28",
    reviewState: "已核验",
    score: 94,
    categoryCode: "H3",
    regionCode: "GB-ENG",
    riskCode: "U3",
    favorites: 0,
    comments: 0,
    counters: 0,
  },
];

type GoldSample = {
  sample_id?: string;
  id?: string;
  primary_category_code?: string;
  title?: string;
  domain?: string;
  country_region_code?: string;
  card_type?: CardType;
  primary_action?: string;
  publishability?: string;
  source_organization?: string;
  source_urls?: string[];
  source_checked_at?: string;
  review_state?: string;
  final_score?: number;
  impact_level_u?: string;
  categoryCode?: string;
  countryRegionCode?: string;
  riskLevel?: string;
  cardType?: CardType;
  primaryAction?: string;
  condition?: string;
  sourceOrganizations?: string[];
  sourceUrls?: string[];
  sourceCheckedAt?: string;
  counts?: {
    favorites?: number;
    comments?: number;
    openFeedback?: number;
  };
  slug?: string;
};

const regionNames: Record<string, string> = {
  CN: "中国",
  HK: "中国香港",
  CA: "加拿大",
  "CA-BC": "加拿大·卑诗省",
  GB: "英国",
  "GB-ENG": "英国·英格兰",
  US: "美国",
  AU: "澳大利亚",
  NZ: "新西兰",
  AE: "阿联酋",
};

function riskFromImpact(impact = "U2"): Post["risk"] {
  if (impact === "U4") return "高";
  if (impact === "U3") return "较高";
  if (impact === "U2") return "中";
  return "低";
}

export function normalizePost(raw: GoldSample): Post {
  const fallback = featuredPosts.find((post) => post.id === (raw.sample_id ?? raw.id));
  const regionCode =
    raw.country_region_code ?? raw.countryRegionCode ?? fallback?.regionCode ?? "";
  const riskCode = (raw.impact_level_u ??
    raw.riskLevel ??
    fallback?.riskCode ??
    "U2") as Post["riskCode"];
  return {
    id: raw.sample_id ?? raw.id ?? fallback?.id ?? "unknown",
    slug: raw.slug,
    title: raw.title ?? fallback?.title ?? "待补充标题",
    domain: raw.domain ?? fallback?.domain ?? "其他",
    categoryCode:
      raw.primary_category_code ??
      raw.categoryCode ??
      fallback?.categoryCode ??
      "OTHER",
    region: regionNames[regionCode] ?? regionCode ?? fallback?.region ?? "不限地区",
    regionCode,
    risk: riskFromImpact(riskCode),
    riskCode,
    cardType: raw.card_type ?? raw.cardType ?? fallback?.cardType ?? "action_checklist",
    action: raw.primary_action ?? raw.primaryAction ?? fallback?.action ?? "打开详情，先核对适用条件和来源。",
    condition: raw.publishability ?? raw.condition ?? fallback?.condition ?? "请结合地区、时间与个人情况判断。",
    sourceName:
      raw.source_organization ??
      raw.sourceOrganizations?.join("；") ??
      fallback?.sourceName ??
      "避坑指南编辑部",
    sourceUrl: raw.source_urls?.[0] ?? raw.sourceUrls?.[0] ?? fallback?.sourceUrl,
    checkedAt: raw.source_checked_at ?? raw.sourceCheckedAt ?? fallback?.checkedAt ?? "待复核",
    reviewState: raw.review_state === "approved" ? "已核验" : raw.review_state ?? fallback?.reviewState ?? "待复核",
    score: raw.final_score ?? fallback?.score ?? 80,
    favorites: raw.counts?.favorites ?? fallback?.favorites ?? 0,
    comments: raw.counts?.comments ?? fallback?.comments ?? 0,
    counters: raw.counts?.openFeedback ?? fallback?.counters ?? 0,
    summary: raw.publishability,
  };
}

export async function loadPosts(): Promise<Post[]> {
  try {
    const apiResponse = await fetch("/api/posts?limit=50", { headers: { Accept: "application/json" } });
    if (apiResponse.ok) {
      const payload = await apiResponse.json();
      const rows = Array.isArray(payload)
        ? payload
        : payload?.data?.items ?? payload?.items;
      if (Array.isArray(rows) && rows.length) return rows.map(normalizePost);
    }
  } catch {
    // The reviewed local seed remains available while the API is starting.
  }

  try {
    const response = await fetch("/data/gold-samples.jsonl");
    if (!response.ok) throw new Error("seed unavailable");
    const text = await response.text();
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => normalizePost(JSON.parse(line)));
  } catch {
    return featuredPosts;
  }
}

export async function loadPost(id: string): Promise<Post | null> {
  try {
    const response = await fetch(`/api/posts/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const payload = await response.json();
      if (payload?.data) return normalizePost(payload.data);
    }
  } catch {
    // The local reviewed dataset is the explicit read-only fallback.
  }
  const rows = await loadPosts();
  return rows.find((item) => item.id === id || item.slug === id) ?? null;
}
