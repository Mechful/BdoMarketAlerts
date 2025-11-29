import { type TrackedItem, type InsertTrackedItem } from "@shared/schema";

export interface IStorage {
  getTrackedItems(): Promise<TrackedItem[]>;
  getTrackedItem(id: number, sid: number): Promise<TrackedItem | undefined>;
  addTrackedItem(item: InsertTrackedItem): Promise<TrackedItem>;
  removeTrackedItem(id: number, sid?: number): Promise<boolean>;
  updateTrackedItem(id: number, sid: number, updates: Partial<TrackedItem>): Promise<TrackedItem | undefined>;
}

export class MemStorage implements IStorage {
  private items: Map<string, TrackedItem>;

  constructor() {
    this.items = new Map();
  }

  private getKey(id: number, sid: number): string {
    return `${id}-${sid}`;
  }

  async getTrackedItems(): Promise<TrackedItem[]> {
    return Array.from(this.items.values());
  }

  async getTrackedItem(id: number, sid: number): Promise<TrackedItem | undefined> {
    return this.items.get(this.getKey(id, sid));
  }

  async addTrackedItem(item: InsertTrackedItem): Promise<TrackedItem> {
    const trackedItem: TrackedItem = {
      ...item,
      addedAt: Date.now(),
    };
    this.items.set(this.getKey(item.id, item.sid), trackedItem);
    return trackedItem;
  }

  async removeTrackedItem(id: number, sid?: number): Promise<boolean> {
    if (sid !== undefined) {
      return this.items.delete(this.getKey(id, sid));
    }
    
    let removed = false;
    for (const [key, item] of this.items.entries()) {
      if (item.id === id) {
        this.items.delete(key);
        removed = true;
      }
    }
    return removed;
  }

  async updateTrackedItem(id: number, sid: number, updates: Partial<TrackedItem>): Promise<TrackedItem | undefined> {
    const key = this.getKey(id, sid);
    const existing = this.items.get(key);
    if (!existing) return undefined;
    
    const updated: TrackedItem = { ...existing, ...updates };
    this.items.set(key, updated);
    return updated;
  }
}

export const storage = new MemStorage();
