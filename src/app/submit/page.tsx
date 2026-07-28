import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = { title: "分享经历" };

export default function SubmitPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-shell inner-page">
        <header className="page-title-row submit-title">
          <div>
            <p className="eyebrow">LEAVE A ROAD SIGN / 留下一块路标</p>
            <h1>分享一件你希望别人提前知道的事</h1>
          </div>
          <aside>
            <b>这里不是曝光墙</b>
            <span>写条件、事实和行动；不要公开无关隐私，也不要给未经裁定的行为定罪。</span>
          </aside>
        </header>
        <div className="process-line" aria-label="投稿流程">
          <span className="active">1 整理经历</span><span>2 登录补证</span><span>3 脱敏审核</span><span>4 发布与纠错</span>
        </div>
        <SubmitForm />
      </main>
    </>
  );
}
