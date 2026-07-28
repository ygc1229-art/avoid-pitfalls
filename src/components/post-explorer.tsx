"use client";

import { useEffect, useMemo, useState } from "react";
import { loadPosts, type Post } from "./post-data";
import { PostCard } from "./post-card";

type Filters = {
  query?: string;
  domain?: string;
  region?: string;
  risk?: string;
  cardType?: string;
  category?: string;
};

export function PostExplorer({ filters }: { filters: Filters }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;
    loadPosts()
      .then((rows) => {
        if (!active) return;
        setPosts(rows);
        setUsingFallback(rows.length === 50);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const query = filters.query?.trim().toLowerCase();
    return posts.filter((post) => {
      const haystack = `${post.title} ${post.action} ${post.domain} ${post.region}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filters.domain && post.domain !== filters.domain) return false;
      if (filters.region && post.regionCode !== filters.region) return false;
      if (filters.risk && post.riskCode !== filters.risk) return false;
      if (filters.cardType && post.cardType !== filters.cardType) return false;
      if (filters.category && post.categoryCode !== filters.category) return false;
      return true;
    });
  }, [filters, posts]);

  if (loading) {
    return <div className="loading-state" role="status"><span />正在整理经验库…</div>;
  }

  return (
    <div>
      <div className="result-meta">
        <p>找到 <strong>{visible.length}</strong> 条相关内容</p>
        {usingFallback && <span className="local-note">当前展示首批审定样本</span>}
      </div>
      {visible.length ? (
        <div className="post-grid">
          {visible.map((post) => <PostCard post={post} key={post.id} />)}
        </div>
      ) : (
        <div className="empty-state">
          <strong>这条路还没人留下路标</strong>
          <p>换一个更宽的关键词，或成为第一个分享经验的人。</p>
          <a className="button button-primary" href="/submit">提交一个坑</a>
        </div>
      )}
    </div>
  );
}
