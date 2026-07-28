import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool, PoolClient } from "pg";
import { hashPassword } from "../src/lib/security";

type GoldSample = {
  sample_id: string;
  domain: string;
  primary_category_code: string;
  title: string;
  card_type: "experience" | "action_checklist" | "rule_update";
  knowledge_identity: "public_source_card" | "editorial_checklist";
  source_tier: string;
  impact_level_u: "U1" | "U2" | "U3" | "U4";
  moderation_risk_m: "M1" | "M2" | "M3";
  publishability: string;
  source_checked_at: string;
  source_urls: string[];
  source_organization: string;
  country_region_code: string;
  primary_action: string;
  final_score: number;
};

const SYSTEM_EMAIL = "system-editor@avoid-pitfalls.invalid";
const SYSTEM_NAME = "避坑指南系统编辑部";

async function loadSamples() {
  const source = await fs.readFile(
    path.join(process.cwd(), "public", "data", "gold-samples.jsonl"),
    "utf8",
  );
  return source
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoldSample);
}

async function ensureSystemEditor(client: PoolClient) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO users
      (email, password_hash, display_name, role, account_kind,
       age_confirmed, terms_accepted_at)
     VALUES ($1, NULL, $2, 'system', 'system', TRUE, NOW())
     ON CONFLICT ((lower(email))) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       role = 'system',
       account_kind = 'system',
       password_hash = NULL
     RETURNING id`,
    [SYSTEM_EMAIL, SYSTEM_NAME],
  );
  return result.rows[0].id;
}

async function ensureOptionalAdmin(client: PoolClient) {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password || password.length < 10) {
    throw new Error(
      "SEED_ADMIN_EMAIL 与至少 10 位的 SEED_ADMIN_PASSWORD 必须同时提供。",
    );
  }
  const passwordHash = await hashPassword(password);
  await client.query(
    `INSERT INTO users
      (email, password_hash, display_name, role, account_kind,
       age_confirmed, terms_accepted_at)
     VALUES ($1, $2, '初始管理员', 'admin', 'person', TRUE, NOW())
     ON CONFLICT ((lower(email))) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       status = 'active'`,
    [email, passwordHash],
  );
}

async function seedSample(
  client: PoolClient,
  systemEditorId: string,
  sample: GoldSample,
) {
  await client.query(
    `INSERT INTO regions (code, name)
     VALUES ($1, $1) ON CONFLICT (code) DO NOTHING`,
    [sample.country_region_code],
  );
  const post = await client.query<{ id: string }>(
    `INSERT INTO posts
      (external_id, slug, author_id, title, summary, body, primary_action,
       condition_text, domain, category_code, country_region_code,
       risk_level, moderation_risk, card_type, knowledge_identity,
       source_tier, source_checked_at, is_firsthand, status, score,
       published_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
       $13, $14, $15, $16, $17, FALSE, 'published', $18, NOW())
     ON CONFLICT (external_id) DO UPDATE SET
       title = EXCLUDED.title,
       summary = EXCLUDED.summary,
       body = EXCLUDED.body,
       primary_action = EXCLUDED.primary_action,
       country_region_code = EXCLUDED.country_region_code,
       risk_level = EXCLUDED.risk_level,
       moderation_risk = EXCLUDED.moderation_risk,
       card_type = EXCLUDED.card_type,
       knowledge_identity = EXCLUDED.knowledge_identity,
       source_tier = EXCLUDED.source_tier,
       source_checked_at = EXCLUDED.source_checked_at,
       score = EXCLUDED.score,
       updated_at = NOW()
     RETURNING id`,
    [
      sample.sample_id,
      sample.sample_id.toLowerCase(),
      systemEditorId,
      sample.title,
      sample.publishability,
      `${sample.publishability}\n\n行动建议：${sample.primary_action}`,
      sample.primary_action,
      "适用范围与例外以来源页面和卡片说明为准。",
      sample.domain,
      sample.primary_category_code,
      sample.country_region_code,
      sample.impact_level_u,
      sample.moderation_risk_m,
      sample.card_type,
      sample.knowledge_identity,
      sample.source_tier,
      sample.source_checked_at,
      sample.final_score,
    ],
  );
  const postId = post.rows[0].id;
  await client.query(
    `INSERT INTO post_regions (post_id, region_code, relation_type)
     VALUES ($1, $2, 'applies_to') ON CONFLICT DO NOTHING`,
    [postId, sample.country_region_code],
  );
  await client.query(
    `DELETE FROM source_evidence
      WHERE post_id = $1 AND evidence_kind = 'official_source'`,
    [postId],
  );

  const organizations = sample.source_organization
    .split("；")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const [index, sourceUrl] of sample.source_urls.entries()) {
    await client.query(
      `INSERT INTO source_evidence
        (post_id, submitted_by, evidence_kind, source_url,
         source_organization, description, visibility, verification_status)
       VALUES ($1, $2, 'official_source', $3, $4, $5, 'public', 'checked')`,
      [
        postId,
        systemEditorId,
        sourceUrl,
        organizations[index] ?? organizations[0] ?? "公开来源",
        "会议 1.4 金标准样本记录的公开来源；系统未将其包装为真人亲历。",
      ],
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("缺少 DATABASE_URL；seed 未执行，也没有写入任何数据。");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const editorId = await ensureSystemEditor(client);
    await ensureOptionalAdmin(client);
    const samples = await loadSamples();
    for (const sample of samples) {
      await seedSample(client, editorId, sample);
    }
    await client.query("COMMIT");
    console.log(
      `Seeded ${samples.length} public-source/editorial samples as ${SYSTEM_NAME}.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
