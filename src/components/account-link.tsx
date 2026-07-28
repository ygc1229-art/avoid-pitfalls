"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AccountLink() {
  const [label, setLabel] = useState("登录");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.data?.user) setLabel(payload.data.user.displayName);
      })
      .catch(() => undefined);
  }, []);

  return (
    <Link
      className="button button-compact"
      href={label === "登录" ? "/login" : "/profile"}
    >
      {label}
    </Link>
  );
}
