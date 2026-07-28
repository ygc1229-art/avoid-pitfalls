import type { Metadata } from "next";
import { ProfileDashboard } from "@/components/profile-dashboard";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "我的贡献" };

export default function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <main className="page-shell inner-page">
        <ProfileDashboard />
      </main>
    </>
  );
}
