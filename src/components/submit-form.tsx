"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type Draft = Record<string, string>;

const DRAFT_KEY = "avoid-pitfalls:post-draft";

export function SubmitForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({});
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ id: string; slug: string } | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) setDraft(JSON.parse(saved));
    } finally {
      setLoaded(true);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const raw = Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, String(value)]),
    ) as Draft;
    const happenedAt = raw.happenedAt
      ? new Date(`${raw.happenedAt}-01T00:00:00.000Z`).toISOString()
      : undefined;
    const payload = {
      title: raw.title,
      summary: raw.summary,
      body: raw.body,
      primaryAction: raw.primaryAction,
      condition: raw.condition,
      domain: raw.domain,
      categoryCode: raw.categoryCode,
      countryRegionCode: raw.countryRegionCode,
      riskLevel: raw.riskLevel,
      cardType: "experience",
      happenedAt,
      tags: raw.tags
        ? raw.tags.split(/[，,\s]+/).map((tag) => tag.trim()).filter(Boolean)
        : [],
      evidence: raw.evidenceUrl
        ? [{
            kind: "other",
            url: raw.evidenceUrl,
            description: raw.evidenceDescription || "投稿人提供的待审核来源",
          }]
        : [],
      consentToPublish: form.get("consentToPublish") === "on",
    };

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(raw));
        router.push("/login?next=%2Fsubmit");
        return;
      }
      if (!response.ok) {
        throw new Error(result?.error?.message ?? "投稿未送达，请检查后重试。");
      }
      sessionStorage.removeItem(DRAFT_KEY);
      setSubmitted(result.data.post);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "投稿未送达，请稍后重试。",
      );
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <section className="submit-gate">
        <span className="submit-gate-mark">✓</span>
        <p className="eyebrow">REVIEW QUEUE / 已进入审核</p>
        <h2>投稿已真实保存，审核通过前不会公开</h2>
        <p>编号：{submitted.id}。审核团队会先检查适用条件、隐私和证据身份。</p>
        <div>
          <Link className="button button-primary" href="/profile">查看我的贡献</Link>
          <Link className="button button-secondary" href="/search">继续浏览</Link>
        </div>
      </section>
    );
  }

  if (!loaded) {
    return <div className="loading-state" role="status"><span />正在读取本机草稿…</div>;
  }

  return (
    <form className="submit-form" key={JSON.stringify(draft)} onSubmit={submit}>
      {Object.keys(draft).length > 0 && (
        <p className="form-success">已恢复你登录前填写的本机草稿，内容尚未提交。</p>
      )}

      <div className="form-section">
        <span className="form-number">01</span>
        <div>
          <h2>先说清楚适用条件</h2>
          <p>地区、时间和问题类型决定这条经验能否帮助别人。</p>
          <div className="form-grid">
            <label>
              <span>场景 *</span>
              <select name="domain" required defaultValue={draft.domain ?? ""}>
                <option value="">请选择</option>
                <option>租房</option><option>求职</option><option>留学</option>
                <option>旅行</option><option>消费</option>
              </select>
            </label>
            <label>
              <span>二级分类代码 *</span>
              <input name="categoryCode" required minLength={1} maxLength={20} defaultValue={draft.categoryCode} placeholder="例如 H4 / J1 / E4" />
            </label>
            <label>
              <span>地区代码 *</span>
              <input name="countryRegionCode" required minLength={2} maxLength={24} defaultValue={draft.countryRegionCode ?? "CN"} placeholder="例如 CN / HK / GB-ENG" />
            </label>
            <label>
              <span>影响程度 *</span>
              <select name="riskLevel" required defaultValue={draft.riskLevel ?? "U2"}>
                <option value="U1">U1 · 较低</option>
                <option value="U2">U2 · 中等</option>
                <option value="U3">U3 · 较高</option>
                <option value="U4">U4 · 严重</option>
              </select>
            </label>
            <label>
              <span>发生时间</span>
              <input name="happenedAt" type="month" defaultValue={draft.happenedAt} />
            </label>
            <label>
              <span>标签</span>
              <input name="tags" maxLength={160} defaultValue={draft.tags} placeholder="押金，隐藏费用，首次租房" />
            </label>
          </div>
          <label className="full-field">
            <span>适用边界 *</span>
            <textarea name="condition" required minLength={8} maxLength={500} rows={3} defaultValue={draft.condition} placeholder="说明国家/城市、身份、时间或合同类型；不要写“所有人都适用”。" />
          </label>
        </div>
      </div>

      <div className="form-section">
        <span className="form-number">02</span>
        <div>
          <h2>把经历写成可以复核的事实</h2>
          <label className="full-field">
            <span>标题 *</span>
            <input name="title" required minLength={8} maxLength={120} defaultValue={draft.title} placeholder="例如：签约后才发现费用不在最初报价里" />
          </label>
          <label className="full-field">
            <span>卡片摘要 *</span>
            <textarea name="summary" required minLength={20} maxLength={300} rows={3} defaultValue={draft.summary} placeholder="20–300 字：发生了什么、可能损失什么，不作未经证明的定罪。" />
          </label>
          <label className="full-field">
            <span>关键经过 *</span>
            <textarea name="body" required minLength={50} maxLength={12000} rows={8} defaultValue={draft.body} placeholder="按时间顺序写经过。删除姓名、电话、证件号、完整地址和无关健康信息。" />
          </label>
        </div>
      </div>

      <div className="form-section">
        <span className="form-number">03</span>
        <div>
          <h2>给后来者一个第一动作</h2>
          <label className="full-field">
            <span>立即动作 *</span>
            <input name="primaryAction" required minLength={8} maxLength={300} defaultValue={draft.primaryAction} placeholder="用动词开头，例如：付款前让对方逐项写明费用" />
          </label>
          <div className="form-grid">
            <label>
              <span>可公开核对的来源 URL</span>
              <input name="evidenceUrl" type="url" maxLength={2000} defaultValue={draft.evidenceUrl} placeholder="https://…" />
            </label>
            <label>
              <span>来源说明</span>
              <input name="evidenceDescription" maxLength={300} defaultValue={draft.evidenceDescription} placeholder="例如：当地主管机关规则页面" />
            </label>
          </div>
          <fieldset className="consent-box">
            <legend>投稿前确认</legend>
            <label><input name="consentToPublish" type="checkbox" required /> 我已删除无关个人信息，并同意内容进入审核</label>
            <p>当前第一版只接受公开 URL；合同、聊天和票据原图的私有上传尚未开放。</p>
          </fieldset>
        </div>
      </div>

      {error && <p className="form-alert" role="alert">{error}</p>}
      <button className="button button-primary submit-next" disabled={pending} type="submit">
        {pending ? "正在安全送审…" : "提交审核 →"}
      </button>
      <p className="source-caveat">未登录时会先保存到当前浏览器并引导登录；只有接口返回成功才算真正提交。</p>
    </form>
  );
}
