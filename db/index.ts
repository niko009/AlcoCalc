import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getD1() {
  const d1 = (
    globalThis as typeof globalThis & { __ALCOCALC_DB__?: D1Database }
  ).__ALCOCALC_DB__;
  if (!d1) {
    throw new Error("Sites database binding `DB` is unavailable.");
  }
  return d1;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
