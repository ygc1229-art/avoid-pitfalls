"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Viewer = { id: string; displayName: string } | null;
type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { displayName: string; level: number };
};

export function PostInteractions({
  postId,
  initialFavorites,
}: {
  postId: string;
  initialFavorites: number;
}) {
  const [viewer, setViewer] = useState<Viewer | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [favoriteCount, setFavoriteCount] = useState(initialFavorites);
  const [favorited, setFavorited] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((response) => response.json()),
      fetch(`/api/posts/${encodeURIComponent(postId)}/comments`).then((response) =>
        response.json(),
      ),
    ])
      .then(([me, discussion]) => {
        setViewer(me?.data?.user ?? null);
        setComments(discussion?.data?.items ?? []);
      })
      .catch(() => setViewer(null));
  }, [postId]);

  async function toggleFavorite() {
    if (!viewer) return;
    setMessage("");
    const next = !favorited;
    const response = await fetch(
      `/api/posts/${encodeURIComponent(postId)}/favorite`,
      { method: next ? "POST" : "DELETE" },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "收藏没有保存，请稍后重试。");
      return;
    }
    setFavorited(next);
    setFavoriteCount((count) => Math.max(0, count + (next ? 1 : -1)));
    setMessage(next ? "已真实保存到你的收藏。" : "已取消收藏。");
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") ?? "");
    const response = await fetch(
      `/api/posts/${encodeURIComponent(postId)}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload?.error?.message ?? "评论没有保存，请稍后重试。");
      return;
    }
    setComments((items) => [...items, payload.data]);
    form.reset();
    setMessage("评论已发布。请继续围绕条件和事实讨论。");
  }

  async function addFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      type: data.get("type"),
      reason: data.get("reason"),
      evidenceUrl: data.get("evidenceUrl") || undefined,
      suggestedCorrection: data.get("suggestedCorrection") || undefined,
    };
    const response = await fetch(
      `/api/posts/${encodeURIComponent(postId)}/feedback`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result?.error?.message ?? "线索没有保存，请稍后重试。");
      return;
    }
    form.reset();
    setMessage("线索已进入复核队列；提交不会直接把帖子判定为假。");
  }

  const loginHref = `/login?next=${encodeURIComponent(`/posts/${postId}`)}`;

  return (
    <>
      <div className="engagement-bar">
        {viewer ? (
          <button type="button" onClick={toggleFavorite}>
            {favorited ? "取消收藏" : "收藏"} {favoriteCount}
          </button>
        ) : (
          <Link href={loginHref}>登录后收藏 {favoriteCount}</Link>
        )}
        <a href="#discussion">评论 {comments.length}</a>
        <a href="#counter">补充 / 反证 / 已过期</a>
        <span aria-live="polite">{message}</span>
      </div>

      <section className="counter-panel" id="counter">
        <div>
          <p className="eyebrow">KEEP IT CORRECT / 帮它保持准确</p>
          <h2>情况变了，或你有不同证据？</h2>
          <p>线索会进入复核，不以票数裁定事实。请写明地区、时间和不同结果。</p>
        </div>
        {viewer ? (
          <form className="compact-form" onSubmit={addFeedback}>
            <label>
              <span>线索类型</span>
              <select name="type" required defaultValue="outdated">
                <option value="outdated">可能已过期</option>
                <option value="rule_changed">规则已经变化</option>
                <option value="missing_context">缺少适用条件</option>
                <option value="denial">有相反事实或证据</option>
              </select>
            </label>
            <label>
              <span>理由 *</span>
              <textarea name="reason" required minLength={10} maxLength={2000} rows={4} />
            </label>
            <label>
              <span>公开证据 URL</span>
              <input name="evidenceUrl" type="url" maxLength={2000} />
            </label>
            <label>
              <span>建议如何修正</span>
              <textarea name="suggestedCorrection" maxLength={2000} rows={3} />
            </label>
            <button className="button button-secondary" type="submit">提交复核线索</button>
          </form>
        ) : (
          <Link className="button button-secondary" href={loginHref}>登录后提交线索</Link>
        )}
      </section>

      <section className="comment-area" id="discussion">
        <div className="section-heading">
          <div>
            <p className="eyebrow">DISCUSSION / 讨论</p>
            <h2>补充条件，不扩大结论</h2>
          </div>
        </div>
        {comments.length > 0 ? (
          <div className="comment-list">
            {comments.map((comment) => (
              <article key={comment.id}>
                <b>{comment.author.displayName} · LV.{comment.author.level}</b>
                <p>{comment.body}</p>
                <time>{new Date(comment.createdAt).toLocaleString("zh-CN")}</time>
              </article>
            ))}
          </div>
        ) : (
          <p className="source-caveat">目前还没有公开评论。</p>
        )}
        {viewer ? (
          <form className="compact-form" onSubmit={addComment}>
            <label>
              <span>补充你的地区、时间和具体条件</span>
              <textarea name="body" required minLength={2} maxLength={2000} rows={4} />
            </label>
            <button className="button button-primary" type="submit">发布评论</button>
          </form>
        ) : (
          <div className="login-comment">
            <p>登录后可以评论；阅读始终无需登录。</p>
            <Link className="button button-primary" href={loginHref}>登录后评论</Link>
          </div>
        )}
      </section>
    </>
  );
}
