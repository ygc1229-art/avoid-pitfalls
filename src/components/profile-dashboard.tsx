"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  points: number;
  level: number;
};

const badges = [
  { mark: "✦", name: "第一块路标", note: "完成首个被认可的贡献", threshold: 20 },
  { mark: "⌁", name: "探路者", note: "持续贡献可复用知识", threshold: 140 },
  { mark: "◉", name: "社区守望者", note: "长期帮助社区补充与纠错", threshold: 600 },
  { mark: "↗", name: "公共知识建造者", note: "形成高质量持续贡献", threshold: 1600 },
];

export function ProfileDashboard() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error?.message);
        setUser(payload?.data?.user ?? null);
      })
      .catch(() => {
        setUser(null);
        setMessage("账号服务暂时不可用；公开搜索仍可正常使用。");
      });
  }, []);

  const nextBadge = useMemo(
    () => badges.find((badge) => badge.threshold > (user?.points ?? 0)),
    [user?.points],
  );

  if (user === undefined) {
    return <div className="loading-state" role="status"><span />正在读取你的真实贡献记录…</div>;
  }

  if (!user) {
    return (
      <section className="empty-state">
        <strong>登录后查看你的贡献</strong>
        <p>{message || "这里不会展示虚构等级或示例成绩。"}</p>
        <Link className="button button-primary" href="/login?next=%2Fprofile">登录 / 注册</Link>
      </section>
    );
  }

  return (
    <>
      <section className="profile-hero">
        <div className="profile-avatar">{user.displayName.slice(0, 1)}</div>
        <div>
          <p className="eyebrow">CONTRIBUTOR / 贡献者</p>
          <h1>{user.displayName}</h1>
          <p>{user.email} · {user.role === "user" ? "社区成员" : "审核团队"}</p>
        </div>
        <Link className="button button-secondary" href="/submit">＋ 留下新经验</Link>
      </section>

      <section className="level-panel">
        <div className="level-badge"><span>LV.</span><strong>{user.level}</strong></div>
        <div className="level-progress">
          <div><b>真实贡献积分</b><span>{user.points} XP</span></div>
          <div className="progress-track">
            <span
              style={{
                width: `${Math.min(
                  100,
                  nextBadge ? (user.points / nextBadge.threshold) * 100 : 100,
                )}%`,
              }}
            />
          </div>
          <p>
            {nextBadge
              ? `距离「${nextBadge.name}」还差 ${nextBadge.threshold - user.points} 积分。`
              : "你已达到当前版本的最高贡献门槛。"}
            积分只来自审核通过的投稿、有效评论和被采纳的纠错。
          </p>
        </div>
      </section>

      <section className="profile-section">
        <div className="section-heading">
          <div><p className="eyebrow">BADGES / 贡献勋章</p><h2>由真实积分解锁</h2></div>
        </div>
        <div className="badge-grid">
          {badges.map((badge) => {
            const earned = user.points >= badge.threshold;
            return (
              <article className={earned ? "badge-card earned" : "badge-card locked"} key={badge.name}>
                <span>{badge.mark}</span>
                <h3>{badge.name}</h3>
                <p>{badge.note}</p>
                <small>{earned ? "已获得" : `${badge.threshold} XP 解锁`}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="profile-section empty-state">
        <strong>贡献明细仍在建设</strong>
        <p>第一版已记录积分流水和勋章，但尚未提供完整的个人投稿历史接口，因此这里不展示模拟数量。</p>
      </section>
    </>
  );
}
