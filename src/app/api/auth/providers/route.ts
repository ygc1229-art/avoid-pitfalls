import { apiSuccess } from "@/lib/errors";

export async function GET() {
  return apiSuccess({
    providers: [
      {
        id: "credentials",
        label: "邮箱",
        enabled: Boolean(process.env.DATABASE_URL),
        status: process.env.DATABASE_URL ? "available" : "database_required",
      },
      {
        id: "google",
        label: "Google",
        enabled: false,
        configured: Boolean(
          process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
        ),
        status: "adapter_not_implemented",
      },
      {
        id: "wechat",
        label: "微信",
        enabled: false,
        configured: Boolean(
          process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET,
        ),
        status: "adapter_not_implemented",
      },
      {
        id: "phone",
        label: "手机号",
        enabled: false,
        configured: Boolean(
          process.env.SMS_PROVIDER && process.env.SMS_API_KEY,
        ),
        status: "adapter_not_implemented",
      },
    ],
  });
}
