import { pgTable, serial, integer, text, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const trackedItems = pgTable("tracked_items", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull(),
  sid: integer("sid").notNull(),
  name: text("name").notNull(),
  lastPrice: integer("last_price").notNull(),
  lastStock: integer("last_stock").notNull(),
  lastSoldTime: bigint("last_sold_time", { mode: "number" }).notNull(),
  addedAt: bigint("added_at", { mode: "number" }).notNull(),
});

export type TrackedItem = typeof trackedItems.$inferSelect;
export type InsertTrackedItem = typeof trackedItems.$inferInsert;

export const insertTrackedItemSchema = createInsertSchema(trackedItems)
  .omit({ id: true, addedAt: true })
  .refine((data) => data.itemId !== undefined && data.sid !== undefined);

export const bdoItemInfoSchema = z.object({
  id: z.number(),
  sid: z.number(),
  name: z.string(),
  minEnhance: z.number(),
  maxEnhance: z.number(),
  basePrice: z.number(),
  currentStock: z.number(),
  totalTrades: z.number(),
  priceMin: z.number(),
  priceMax: z.number(),
  lastSoldPrice: z.number(),
  lastSoldTime: z.number(),
});

export type BdoItemInfo = z.infer<typeof bdoItemInfoSchema>;

export const priceAlertSchema = z.object({
  item: z.object({
    itemId: z.number(),
    sid: z.number(),
    name: z.string(),
    lastPrice: z.number(),
    lastStock: z.number(),
    lastSoldTime: z.number(),
  }),
  oldPrice: z.number(),
  newPrice: z.number(),
  priceChange: z.enum(["increase", "decrease"]),
  stock: z.number(),
  lastSoldTime: z.number(),
});

export type PriceAlert = z.infer<typeof priceAlertSchema>;
