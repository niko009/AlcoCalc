import { sql } from "drizzle-orm";
import { real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const profiles = sqliteTable("profiles", {
  userEmail: text("user_email")
    .primaryKey()
    .references(() => users.email, { onDelete: "cascade" }),
  weightKg: real("weight_kg").notNull(),
  heightCm: real("height_cm").notNull(),
  age: real("age").notNull(),
  gender: text("gender").notNull(),
  widmarkFactor: real("widmark_factor").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const drinkingSessions = sqliteTable("drinking_sessions", {
  id: text("id").primaryKey(),
  userEmail: text("user_email")
    .notNull()
    .references(() => users.email, { onDelete: "cascade" }),
  status: text("status", { enum: ["active", "completed"] }).notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  maxBac: real("max_bac").notNull().default(0),
  durationHours: real("duration_hours").notNull().default(0),
  totalAlcoholGrams: real("total_alcohol_grams").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const drinks = sqliteTable("drinks", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => drinkingSessions.id, { onDelete: "cascade" }),
  userEmail: text("user_email")
    .notNull()
    .references(() => users.email, { onDelete: "cascade" }),
  type: text("type").notNull(),
  volumeMl: real("volume_ml").notNull(),
  abv: real("abv").notNull(),
  quantity: real("quantity").notNull(),
  consumedAt: text("consumed_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
