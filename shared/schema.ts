import { z } from "zod";

export const trackedItemSchema = z.object({
  id: z.number(),
  sid: z.number(),
  name: z.string(),
  lastPrice: z.number(),
  lastStock: z.number(),
  lastSoldTime: z.number(),
  addedAt: z.number(),
});

export type TrackedItem = z.infer<typeof trackedItemSchema>;

export const insertTrackedItemSchema = trackedItemSchema.omit({ addedAt: true });
export type InsertTrackedItem = z.infer<typeof insertTrackedItemSchema>;

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
  item: trackedItemSchema,
  oldPrice: z.number(),
  newPrice: z.number(),
  priceChange: z.enum(["increase", "decrease"]),
  stock: z.number(),
  lastSoldTime: z.number(),
});

export type PriceAlert = z.infer<typeof priceAlertSchema>;
