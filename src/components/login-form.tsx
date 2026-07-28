"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [credentialsEnabled, setCredentialsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((response) => response.json())
      .then((payload) => {
        const provider = payload?.data?.providers?.find(
          (item: { id: string }) => item.id === "credentials",
        );
        setCredentialsEnabled(Boolean(provider?.enabled));
      })
      .catch(() => setCredentialsEnabled(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const data =
      mode === "register"
        ? {
            email: form.get("email"),
            password: form.get("password"),
            displayName: form.get("displayName"),
            acceptedTerms: form.get("acceptedTerms") === "on",
            ageConfirmed: form.get("ageConfirmed") === "on",
          }
        : {
            email: form.get("email"),
            password: form.get("password"),
          };
    try {
      const response = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.error?.message ?? "暂时无法登录，请检查邮箱和密码。",
        );
      }
      router.push(searchParams.get("next") || "/profile");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录服务暂不可用。");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">登录</button>
        <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">注册</button>
      </div>
      <p className="auth-status">
        <span />{" "}
        {credentialsEnabled === null
          ? "正在检查账号服务"
          : credentialsEnabled
            ? "邮箱账号已可用"
            : "当前为只读预览；启动数据库后可注册"}
      </p>
      <form onSubmit={submit}>
        {mode === "register" && (
          <label><span>昵称</span><input name="displayName" required minLength={2} maxLength={40} autoComplete="nickname" /></label>
        )}
        <label><span>邮箱</span><input name="email" required type="email" autoComplete="email" placeholder="you@example.com" /></label>
        <label><span>密码</span><input name="password" required type="password" minLength={10} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="至少 10 位，包含字母和数字" /></label>
        {mode === "register" && (
          <div className="consent-box">
            <label>
              <input name="acceptedTerms" type="checkbox" required />
              我同意社区规则与隐私说明，不发布无关个人信息
            </label>
            <label>
              <input name="ageConfirmed" type="checkbox" />
              我已满 15 岁；未满 18 岁时会避免公开可识别身份材料
            </label>
          </div>
        )}
        {error && <p className="form-alert" role="alert">{error}</p>}
        <button className="button button-primary button-full" disabled={pending || credentialsEnabled !== true} type="submit">
          {pending ? "正在连接…" : mode === "login" ? "使用邮箱登录" : "创建账号"}
        </button>
      </form>
      <div className="auth-divider"><span>其他方式</span></div>
      <div className="provider-list">
        <button disabled type="button"><b>G</b> Google <small>待配置</small></button>
        <button disabled type="button"><b>微</b> 微信 <small>待配置</small></button>
        <button disabled type="button"><b>＋</b> 手机号 <small>待配置</small></button>
      </div>
      <p className="auth-note">第三方登录仍待正式实现；填写密钥也不会让这些按钮假装可用。</p>
    </div>
  );
}
