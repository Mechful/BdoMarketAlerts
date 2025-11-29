import { type TrackedItem, type InsertTrackedItem } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

export interface IStorage {
  getTrackedItems(): Promise<TrackedItem[]>;
  getTrackedItem(id: number, sid: number): Promise<TrackedItem | undefined>;
  addTrackedItem(item: InsertTrackedItem): Promise<TrackedItem>;
  removeTrackedItem(id: number, sid?: number): Promise<boolean>;
  updateTrackedItem(id: number, sid: number, updates: Partial<TrackedItem>): Promise<TrackedItem | undefined>;
}

export class FileStorage implements IStorage {
  private items: Map<string, TrackedItem>;
  private filePath: string;

  constructor(filePath: string = "tracked-items.json") {
    this.filePath = filePath;
    this.items = new Map();
    this.loadFromFile();
  }

  private getKey(id: number, sid: number): string {
    return `${id}-${sid}`;
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf-8");
        const items: TrackedItem[] = JSON.parse(data);
        this.items.clear();
        items.forEach(item => {
          this.items.set(this.getKey(item.id, item.sid), item);
        });
        console.log(`✓ Loaded ${items.length} tracked items from file`);
      }
    } catch (error) {
      console.error("Error loading tracked items from file:", error);
      this.items = new Map();
    }
  }

  private saveToFile(): void {
    try {
      const items = Array.from(this.items.values());
      fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2), "utf-8");
    } catch (error) {
      console.error("Error saving tracked items to file:", error);
    }
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
    this.saveToFile();
    return trackedItem;
  }

  async removeTrackedItem(id: number, sid?: number): Promise<boolean> {
    let removed = false;
    if (sid !== undefined) {
      removed = this.items.delete(this.getKey(id, sid));
    } else {
      for (const [key, item] of this.items.entries()) {
        if (item.id === id) {
          this.items.delete(key);
          removed = true;
        }
      }
    }
    if (removed) {
      this.saveToFile();
    }
    return removed;
  }

  async updateTrackedItem(id: number, sid: number, updates: Partial<TrackedItem>): Promise<TrackedItem | undefined> {
    const key = this.getKey(id, sid);
    const existing = this.items.get(key);
    if (!existing) return undefined;
    
    const updated: TrackedItem = { ...existing, ...updates };
    this.items.set(key, updated);
    this.saveToFile();
    return updated;
  }
}

export const storage = new FileStorage();
