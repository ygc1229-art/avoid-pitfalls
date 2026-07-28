import { databaseHealth } from "@/lib/db";
import { apiSuccess, withApi } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withApi(async () => {
  const database = await databaseHealth();
  return apiSuccess({
    status: database.available ? "ok" : "degraded",
    database,
    writesEnabled: database.available,
    fallbackDataset: database.available ? null : "gold-samples.jsonl",
  });
});
