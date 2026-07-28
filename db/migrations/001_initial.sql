CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text,
  display_name varchar(40) NOT NULL,
  role varchar(16) NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'moderator', 'admin', 'system')),
  account_kind varchar(16) NOT NULL DEFAULT 'person'
    CHECK (account_kind IN ('person', 'system')),
  status varchar(16) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  age_confirmed boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamptz,
  points integer NOT NULL DEFAULT 0 CHECK (points >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT person_has_password CHECK (
    account_kind = 'system' OR password_hash IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_expires_idx
  ON sessions (user_id, expires_at);

CREATE TABLE IF NOT EXISTS regions (
  code varchar(24) PRIMARY KEY,
  name varchar(120) NOT NULL,
  parent_code varchar(24) REFERENCES regions(code) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(30) NOT NULL,
  slug varchar(40) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id varchar(80) UNIQUE,
  slug varchar(160) NOT NULL UNIQUE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title varchar(120) NOT NULL,
  summary varchar(300) NOT NULL,
  body text NOT NULL,
  primary_action varchar(300) NOT NULL,
  condition_text varchar(500),
  domain varchar(40) NOT NULL,
  category_code varchar(20) NOT NULL,
  country_region_code varchar(24) NOT NULL,
  risk_level varchar(2) NOT NULL
    CHECK (risk_level IN ('U1', 'U2', 'U3', 'U4')),
  moderation_risk varchar(2) NOT NULL DEFAULT 'M2'
    CHECK (moderation_risk IN ('M1', 'M2', 'M3')),
  card_type varchar(24) NOT NULL
    CHECK (card_type IN ('experience', 'action_checklist', 'rule_update')),
  knowledge_identity varchar(32) NOT NULL
    CHECK (knowledge_identity IN (
      'user_submission', 'public_source_card', 'editorial_checklist'
    )),
  source_tier varchar(8),
  source_checked_at date,
  is_firsthand boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'draft', 'pending', 'changes_requested', 'published', 'rejected',
      'hidden', 'expired', 'disputed'
    )),
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  happened_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS posts_public_filters_idx
  ON posts (status, domain, country_region_code, risk_level, published_at DESC);
CREATE INDEX IF NOT EXISTS posts_category_idx
  ON posts (category_code, status);
CREATE INDEX IF NOT EXISTS posts_expiry_idx
  ON posts (expires_at) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS posts_text_search_idx
  ON posts USING gin (
    to_tsvector('simple', title || ' ' || summary || ' ' || primary_action)
  );

CREATE TABLE IF NOT EXISTS post_tags (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS post_regions (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  region_code varchar(24) NOT NULL REFERENCES regions(code) ON DELETE RESTRICT,
  relation_type varchar(20) NOT NULL DEFAULT 'applies_to'
    CHECK (relation_type IN ('applies_to', 'origin', 'destination')),
  PRIMARY KEY (post_id, region_code, relation_type)
);

CREATE TABLE IF NOT EXISTS source_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  evidence_kind varchar(24) NOT NULL
    CHECK (evidence_kind IN (
      'official_source', 'contract', 'receipt', 'conversation', 'photo', 'other'
    )),
  source_url text,
  source_organization varchar(300),
  description varchar(500) NOT NULL,
  occurred_at timestamptz,
  visibility varchar(20) NOT NULL DEFAULT 'reviewers_only'
    CHECK (visibility IN ('public', 'reviewers_only', 'private')),
  verification_status varchar(20) NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN (
      'unverified', 'checked', 'partially_checked', 'rejected'
    )),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS source_evidence_post_idx
  ON source_evidence (post_id, verification_status);

CREATE TABLE IF NOT EXISTS moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  from_status varchar(24) NOT NULL,
  to_status varchar(24) NOT NULL,
  reason_code varchar(40) NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_events_post_idx
  ON moderation_events (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES comments(id) ON DELETE SET NULL,
  body varchar(2000) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_post_created_idx
  ON comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  report_type varchar(24) NOT NULL
    CHECK (report_type IN (
      'denial', 'outdated', 'missing_context', 'rule_changed'
    )),
  reason varchar(2000) NOT NULL,
  evidence_url text,
  suggested_correction varchar(2000),
  status varchar(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'accepted', 'rejected', 'closed')),
  resolution_note text,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_review_queue_idx
  ON reports (status, report_type, created_at);

CREATE TABLE IF NOT EXISTS point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type varchar(32) NOT NULL
    CHECK (event_type IN (
      'post_approved', 'comment_created', 'correction_accepted'
    )),
  points integer NOT NULL CHECK (points BETWEEN -1000 AND 1000),
  reference_type varchar(24) NOT NULL,
  reference_id uuid NOT NULL,
  idempotency_key varchar(160) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS point_events_user_created_idx
  ON point_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(40) NOT NULL UNIQUE,
  name varchar(60) NOT NULL,
  description varchar(300) NOT NULL,
  points_threshold integer NOT NULL CHECK (points_threshold >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_for varchar(160) NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

INSERT INTO badges (code, name, description, points_threshold)
VALUES
  ('first-step', '第一块路标', '完成首个被社区系统认可的贡献。', 20),
  ('pathfinder', '探路者', '持续贡献可复用的避坑知识。', 140),
  ('community-guardian', '社区守望者', '长期帮助社区补充信息与纠错。', 600),
  ('knowledge-builder', '公共知识建造者', '形成高质量、可验证的持续贡献。', 1600)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  points_threshold = EXCLUDED.points_threshold;
