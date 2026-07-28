import Link from "next/link";
import { cardTypeLabels, type Post } from "./post-data";

export function PostCard({ post }: { post: Post }) {
  return (
    <article className={`post-card card-${post.cardType}`}>
      <div className="card-topline">
        <span className="type-label">{cardTypeLabels[post.cardType]}</span>
        <span className={`risk risk-${post.risk}`}>{post.risk}风险</span>
      </div>
      <p className="card-kicker">{post.domain} / {post.region}</p>
      <h3><Link href={`/posts/${encodeURIComponent(post.id)}`}>{post.title}</Link></h3>
      <p className="condition"><b>适用边界</b>{post.condition}</p>
      <div className="action-box">
        <span>先做</span>
        <p>{post.action}</p>
      </div>
      <div className="trust-row">
        <span>来源：{post.sourceName}</span>
        <span>{post.checkedAt} 核验</span>
      </div>
      <div className="card-footer">
        <span>收藏 {post.favorites}</span>
        <span>评论 {post.comments}</span>
        <span>待复核线索 {post.counters}</span>
        <Link href={`/posts/${encodeURIComponent(post.id)}`}>看完整内容 →</Link>
      </div>
    </article>
  );
}
