import { type TrackedItem, type InsertTrackedItem, trackedItems } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getTrackedItems(): Promise<TrackedItem[]>;
  getTrackedItem(id: number, sid: number): Promise<TrackedItem | undefined>;
  addTrackedItem(item: InsertTrackedItem): Promise<TrackedItem>;
  removeTrackedItem(id: number, sid?: number): Promise<boolean>;
  updateTrackedItem(id: number, sid: number, updates: Partial<TrackedItem>): Promise<TrackedItem | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getTrackedItems(): Promise<TrackedItem[]> {
    try {
      return await db.select().from(trackedItems);
    } catch (error) {
      console.error("Error fetching tracked items:", error);
      return [];
    }
  }

  async getTrackedItem(id: number, sid: number): Promise<TrackedItem | undefined> {
    try {
      const results = await db
        .select()
        .from(trackedItems)
        .where(and(eq(trackedItems.itemId, id), eq(trackedItems.sid, sid)))
        .limit(1);
      return results?.[0];
    } catch (error) {
      console.error("Error getting tracked item:", error);
      return undefined;
    }
  }

  async addTrackedItem(item: InsertTrackedItem): Promise<TrackedItem> {
    try {
      const now = Date.now();
      const result = await db
        .insert(trackedItems)
        .values({
          itemId: item.itemId,
          sid: item.sid,
          name: item.name,
          lastPrice: item.lastPrice,
          lastStock: item.lastStock,
          lastSoldTime: item.lastSoldTime,
          addedAt: now,
        })
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error adding tracked item:", error);
      throw error;
    }
  }

  async removeTrackedItem(id: number, sid?: number): Promise<boolean> {
    try {
      if (sid !== undefined) {
        const result = await db
          .delete(trackedItems)
          .where(and(eq(trackedItems.itemId, id), eq(trackedItems.sid, sid)));
        return result.rowCount > 0;
      }

      const result = await db
        .delete(trackedItems)
        .where(eq(trackedItems.itemId, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error removing tracked item:", error);
      return false;
    }
  }

  async updateTrackedItem(id: number, sid: number, updates: Partial<TrackedItem>): Promise<TrackedItem | undefined> {
    try {
      const result = await db
        .update(trackedItems)
        .set({
          lastPrice: updates.lastPrice,
          lastStock: updates.lastStock,
          lastSoldTime: updates.lastSoldTime,
          name: updates.name,
        })
        .where(and(eq(trackedItems.itemId, id), eq(trackedItems.sid, sid)))
        .returning();
      return result?.[0];
    } catch (error) {
      console.error("Error updating tracked item:", error);
      return undefined;
    }
  }
}

export const storage = new DatabaseStorage();
