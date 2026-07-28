import { PoolClient } from "pg";

const LEVEL_THRESHOLDS = [0, 20, 60, 140, 300, 600, 1_000, 1_600, 2_400, 3_500];

export function levelForPoints(points: number) {
  let level = 1;
  LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (points >= threshold) level = index + 1;
  });
  return level;
}

export async function awardPoints(
  client: PoolClient,
  input: {
    userId: string;
    eventType: "post_approved" | "comment_created" | "correction_accepted";
    points: number;
    referenceType: string;
    referenceId: string;
    idempotencyKey: string;
  },
) {
  const inserted = await client.query(
    `INSERT INTO point_events
       (user_id, event_type, points, reference_type, reference_id, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [
      input.userId,
      input.eventType,
      input.points,
      input.referenceType,
      input.referenceId,
      input.idempotencyKey,
    ],
  );
  if (!inserted.rowCount) return;

  const updated = await client.query<{ points: number }>(
    `UPDATE users
        SET points = points + $2,
            updated_at = NOW()
      WHERE id = $1
      RETURNING points`,
    [input.userId, input.points],
  );
  const points = updated.rows[0]?.points ?? 0;
  await client.query("UPDATE users SET level = $2 WHERE id = $1", [
    input.userId,
    levelForPoints(points),
  ]);

  await client.query(
    `INSERT INTO user_badges (user_id, badge_id, awarded_for)
     SELECT $1, b.id, $2
       FROM badges b
      WHERE b.points_threshold <= $3
     ON CONFLICT (user_id, badge_id) DO NOTHING`,
    [input.userId, input.idempotencyKey, points],
  );
}
