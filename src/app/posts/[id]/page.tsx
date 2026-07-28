import type { Metadata } from "next";
import Link from "next/link";
import { PostDetailClient } from "@/components/post-detail-client";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "经验详情" };

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <SiteHeader />
      <main className="page-shell inner-page">
        <Link className="back-link" href="/search">← 返回经验库</Link>
        <PostDetailClient id={decodeURIComponent(id)} />
      </main>
    </>
  );
}
