import { type TrackedItem, type InsertTrackedItem } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";

export interface IStorage {
  getTrackedItems(region: string): Promise<TrackedItem[]>;
  getTrackedItem(id: number, sid: number, region: string): Promise<TrackedItem | undefined>;
  addTrackedItem(item: InsertTrackedItem, region: string): Promise<TrackedItem>;
  removeTrackedItem(id: number, sid: number | undefined, region: string): Promise<boolean>;
  updateTrackedItem(id: number, sid: number, updates: Partial<TrackedItem>, region: string): Promise<TrackedItem | undefined>;
}

export class FileStorage implements IStorage {
  private regionItems: Map<string, Map<string, TrackedItem>>;
  private baseDir: string;

  constructor(baseDir: string = ".") {
    this.baseDir = baseDir;
    this.regionItems = new Map();
    this.loadAllRegions();
  }

  private getKey(id: number, sid: number): string {
    return `${id}-${sid}`;
  }

  private getFilePath(region: string): string {
    return path.join(this.baseDir, `tracked-items-${region}.json`);
  }

  private loadAllRegions(): void {
    const regions = ["eu", "na"];
    regions.forEach(region => {
      this.loadFromFile(region);
    });
  }

  private loadFromFile(region: string): void {
    try {
      const filePath = this.getFilePath(region);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        const items: TrackedItem[] = JSON.parse(data);
        const itemMap = new Map<string, TrackedItem>();
        items.forEach(item => {
          itemMap.set(this.getKey(item.id, item.sid), item);
        });
        this.regionItems.set(region, itemMap);
        console.log(`✓ Loaded ${items.length} tracked items for ${region.toUpperCase()}`);
      } else {
        this.regionItems.set(region, new Map());
      }
    } catch (error) {
      console.error(`Error loading tracked items for ${region}:`, error);
      this.regionItems.set(region, new Map());
    }
  }

  private saveToFile(region: string): void {
    try {
      const items = Array.from(this.regionItems.get(region)?.values() || []);
      const filePath = this.getFilePath(region);
      fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf-8");
    } catch (error) {
      console.error(`Error saving tracked items for ${region}:`, error);
    }
  }

  async getTrackedItems(region: string): Promise<TrackedItem[]> {
    return Array.from(this.regionItems.get(region)?.values() || []);
  }

  async getTrackedItem(id: number, sid: number, region: string): Promise<TrackedItem | undefined> {
    return this.regionItems.get(region)?.get(this.getKey(id, sid));
  }

  async addTrackedItem(item: InsertTrackedItem, region: string): Promise<TrackedItem> {
    const trackedItem: TrackedItem = {
      ...item,
      addedAt: Date.now(),
    };
    const items = this.regionItems.get(region) || new Map();
    items.set(this.getKey(item.id, item.sid), trackedItem);
    this.regionItems.set(region, items);
    this.saveToFile(region);
    return trackedItem;
  }

  async removeTrackedItem(id: number, sid: number | undefined, region: string): Promise<boolean> {
    const items = this.regionItems.get(region);
    if (!items) return false;

    let removed = false;
    if (sid !== undefined) {
      removed = items.delete(this.getKey(id, sid));
    } else {
      const keysToDelete: string[] = [];
      items.forEach((item, key) => {
        if (item.id === id) {
          keysToDelete.push(key);
          removed = true;
        }
      });
      keysToDelete.forEach(key => items.delete(key));
    }
    if (removed) {
      this.saveToFile(region);
    }
    return removed;
  }

  async updateTrackedItem(id: number, sid: number, updates: Partial<TrackedItem>, region: string): Promise<TrackedItem | undefined> {
    const items = this.regionItems.get(region);
    if (!items) return undefined;

    const key = this.getKey(id, sid);
    const existing = items.get(key);
    if (!existing) return undefined;
    
    const updated: TrackedItem = { ...existing, ...updates };
    items.set(key, updated);
    this.saveToFile(region);
    return updated;
  }
}

export const storage = new FileStorage();
