import Image from "next/image";
import Link from "next/link";
import { PostCard } from "@/components/post-card";
import { SearchBar } from "@/components/search-bar";
import { SiteHeader } from "@/components/site-header";
import { featuredPosts } from "@/components/post-data";

const domains = [
  { name: "租房", note: "合同、押金、入住与退租", mark: "01" },
  { name: "求职", note: "招聘、面试、合同与离职", mark: "02" },
  { name: "留学", note: "选校、签证、住宿与缴费", mark: "03" },
  { name: "旅行", note: "预订、交通、安全与退改", mark: "04" },
  { name: "消费", note: "订阅、售后、二手与大额购买", mark: "05" },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero page-shell">
          <div className="hero-copy">
            <p className="eyebrow">OPEN-SOURCE LIFE EXPERIENCE / 公开经验库</p>
            <h1>
              前人踩过的坑，
              <br />
              不该再收一次学费。
            </h1>
            <p className="hero-lead">
              在做决定之前，按场景、地区和风险找到一句能立刻执行的提醒。
              先看适用条件，再看经历；先保护自己，再参与讨论。
            </p>
            <SearchBar prominent />
            <div className="hero-proof" aria-label="内容库概况">
              <span><strong>50</strong> 条首批金标准样本</span>
              <span><strong>5</strong> 个高频生活领域</span>
              <span><strong>匿名</strong> 可搜索与阅读</span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <Image
              src="/brand/hero.png"
              alt=""
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
              priority
            />
            <span className="hero-stamp">先查一下<br />再出发</span>
          </div>
        </section>

        <section className="ticker" aria-label="平台原则">
          <div>
            <span>不是曝光墙</span><b>✦</b>
            <span>区分个案、规则与建议</span><b>✦</b>
            <span>允许补充、反证与过期</span><b>✦</b>
            <span>证据和适用范围同屏</span>
          </div>
        </section>

        <section className="page-shell section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">START WITH A SCENE / 从场景开始</p>
              <h2>你现在准备做什么？</h2>
            </div>
            <Link className="text-link" href="/search">查看全部内容 →</Link>
          </div>
          <div className="domain-grid">
            {domains.map((domain) => (
              <Link
                className="domain-tile"
                href={`/search?domain=${encodeURIComponent(domain.name)}`}
                key={domain.name}
              >
                <span className="domain-number">{domain.mark}</span>
                <h3>{domain.name}</h3>
                <p>{domain.note}</p>
                <span className="domain-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="page-shell section-block">
          <div className="section-heading">
            <div>
              <p className="eyebrow">EDITOR&apos;S BOARD / 首批精选</p>
              <h2>先带走一个动作</h2>
            </div>
            <p className="section-note">每张卡片都先给边界，再给结论。</p>
          </div>
          <div className="post-grid">
            {featuredPosts.map((post) => <PostCard post={post} key={post.id} />)}
          </div>
        </section>

        <section className="page-shell manifesto">
          <p className="eyebrow">WHY WE BUILD / 为什么存在</p>
          <blockquote>
            “我们不收集抱怨。我们把个人经历整理成公共知识，
            减少那些本可以通过信息避免的损失。”
          </blockquote>
          <div className="manifesto-actions">
            <Link className="button button-primary" href="/submit">分享一个真实经历</Link>
            <Link className="button button-secondary" href="/search?cardType=action_checklist">先看行动清单</Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="page-shell footer-inner">
          <div>
            <Image src="/brand/logo-mark.svg" alt="" width={30} height={30} />
            <strong>避坑指南</strong>
          </div>
          <p>把前人的经验，留成看得见的路标。</p>
          <p>V1 · 内容会更新，也可以被纠正。</p>
        </div>
      </footer>
    </>
  );
}
