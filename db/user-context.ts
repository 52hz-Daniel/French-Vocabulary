import type { PoolClient } from "pg";
import { pool } from "./client";
import { DEV_USER_ID } from "./schema";

export function currentUserId(): string {
  return process.env.DEV_USER_ID ?? DEV_USER_ID;
}

export async function withUserClient<T>(userId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
