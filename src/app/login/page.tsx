import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="auth-layout page-shell">
        <section className="auth-intro">
          <p className="eyebrow">JOIN THE COMMON MEMORY / 加入公共经验库</p>
          <h1>阅读不设门槛。<br />参与时，我们记住你的贡献。</h1>
          <ul>
            <li><span>01</span>收藏会同步到你的账号</li>
            <li><span>02</span>投稿、纠错与评论可追踪处理进度</li>
            <li><span>03</span>有效贡献会积累经验值和勋章</li>
          </ul>
          <Image src="/brand/logo-mark.svg" width={120} height={120} alt="" />
        </section>
        <Suspense fallback={<div className="auth-card loading-state">正在载入…</div>}>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
