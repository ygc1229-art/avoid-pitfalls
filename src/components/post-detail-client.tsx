"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cardTypeLabels, featuredPosts, loadPost, type Post } from "./post-data";
import { PostInteractions } from "./post-interactions";

export function PostDetailClient({ id }: { id: string }) {
  const [post, setPost] = useState<Post | null>(featuredPosts.find((item) => item.id === id) ?? null);
  const [loading, setLoading] = useState(!post);

  useEffect(() => {
    let active = true;
    loadPost(id)
      .then((found) => {
        if (active) setPost(found);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="loading-state"><span />正在核对内容…</div>;
  if (!post) {
    return (
      <div className="empty-state">
        <strong>没有找到这条内容</strong>
        <p>它可能已被合并、撤回，或者链接不完整。</p>
        <Link className="button button-primary" href="/search">回到经验库</Link>
      </div>
    );
  }

  return (
    <article className={`detail-sheet detail-${post.cardType}`}>
      <header className="detail-header">
        <div className="card-topline">
          <span className="type-label">{cardTypeLabels[post.cardType]}</span>
          <span className={`risk risk-${post.risk}`}>{post.risk}风险</span>
          <span className="verified">{post.reviewState}</span>
        </div>
        <p className="card-kicker">{post.domain} / {post.region} / 编号 {post.id}</p>
        <h1>{post.title}</h1>
        <p className="detail-condition"><b>这条内容适用于</b>{post.condition}</p>
      </header>

      <section className="detail-action">
        <span>现在先做</span>
        <h2>{post.action}</h2>
        <p>不要只保存结论。行动前请再次核对地区、日期和你的具体合同或规则版本。</p>
      </section>

      <div className="detail-columns">
        <div>
          <section className="detail-section">
            <p className="eyebrow">WHAT WE KNOW / 已知信息</p>
            <h2>把结论放回它发生的条件里</h2>
            <p>
              这是一条经过结构化整理的{cardTypeLabels[post.cardType]}。
              它提供的是决策线索，不代替律师、医生、持牌顾问或主管机关的个案意见。
              如果你的地区、时间或合同条款不同，结论也可能不同。
            </p>
          </section>
          <section className="detail-section">
            <p className="eyebrow">CHECKLIST / 行动顺序</p>
            <ol className="step-list">
              <li><b>保存现场</b><span>保留页面、合同、付款和沟通记录，并遮住无关个人信息。</span></li>
              <li><b>独立核对</b><span>不要只使用对方提供的链接，从主管机关或机构官网重新进入。</span></li>
              <li><b>书面确认</b><span>把口头承诺改成可回看的文字，并记录日期、金额与责任人。</span></li>
            </ol>
          </section>
        </div>
        <aside className="source-panel">
          <p className="eyebrow">SOURCE & FRESHNESS / 来源与时效</p>
          <dl>
            <div><dt>来源</dt><dd>{post.sourceName}</dd></div>
            <div><dt>最近核验</dt><dd>{post.checkedAt}</dd></div>
            <div><dt>内容评分</dt><dd>{post.score} / 100</dd></div>
            <div><dt>适用地区</dt><dd>{post.region}</dd></div>
          </dl>
          {post.sourceUrl && (
            <a className="button button-secondary button-full" href={post.sourceUrl} target="_blank" rel="noreferrer">
              查看原始来源 ↗
            </a>
          )}
          <p className="source-caveat">外部页面可能更新。关键决定请以打开时的官方内容为准。</p>
        </aside>
      </div>

      <PostInteractions postId={post.id} initialFavorites={post.favorites} />
    </article>
  );
}
