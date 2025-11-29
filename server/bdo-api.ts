import type { BdoItemInfo } from "@shared/schema";

const BASE_URL = "https://api.arsha.io";
const REGION = process.env.BDO_REGION || "eu";

export async function getItemInfo(id: number, sid: number = 0): Promise<BdoItemInfo | null> {
  try {
    const url = `${BASE_URL}/v2/${REGION}/item?id=${id}&lang=en`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`BDO API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data) {
      return null;
    }
    
    // API can return either a single object or an array
    let itemData: any;
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return null;
      }
      itemData = data.find((item: any) => 
        item.sid === sid || item.minEnhance === sid
      ) || data[0];
    } else {
      // Single object response
      itemData = data;
    }
    
    return {
      id: itemData.id || id,
      sid: itemData.sid ?? sid,
      name: itemData.name || `Item ${id}`,
      minEnhance: itemData.minEnhance || 0,
      maxEnhance: itemData.maxEnhance || 0,
      basePrice: itemData.basePrice || 0,
      currentStock: itemData.currentStock || 0,
      totalTrades: itemData.totalTrades || 0,
      priceMin: itemData.priceMin || 0,
      priceMax: itemData.priceMax || 0,
      lastSoldPrice: itemData.lastSoldPrice || 0,
      lastSoldTime: itemData.lastSoldTime || 0,
    };
  } catch (error) {
    console.error("Error fetching item info:", error);
    return null;
  }
}

export async function getItemPriceHistory(id: number, sid: number = 0): Promise<number[] | null> {
  try {
    const url = `${BASE_URL}/v2/${REGION}/history?id=${id}&sid=${sid}&lang=en`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`BDO API history error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching price history:", error);
    return null;
  }
}

export function getItemIconUrl(id: number): string {
  return `https://s1.pearlcdn.com/NAEU/TradeMarket/Common/img/BDO/item/${id}.png`;
}

export function formatSilver(amount: number): string {
  return amount.toLocaleString("en-US");
}

export function formatRelativeTime(epochSeconds: number): string {
  if (!epochSeconds || epochSeconds === 0) {
    return "Never";
  }
  
  const now = Math.floor(Date.now() / 1000);
  const diff = now - epochSeconds;
  
  if (diff < 60) {
    return "Just now";
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  } else if (diff < 2592000) {
    const days = Math.floor(diff / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  } else if (diff < 31536000) {
    const months = Math.floor(diff / 2592000);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  } else {
    const years = Math.floor(diff / 31536000);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
  }
}

export function getEnhancementLabel(sid: number): string {
  if (sid === 0) return "";
  if (sid <= 15) return ` (+${sid})`;
  
  const penLabels: { [key: number]: string } = {
    16: " (PRI)",
    17: " (DUO)",
    18: " (TRI)",
    19: " (TET)",
    20: " (PEN)",
  };
  
  return penLabels[sid] || ` (+${sid})`;
}

export interface SearchResult {
  id: number;
  name: string;
  icon: string;
}

// Cache for the full item database
let itemDatabaseCache: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function loadItemDatabase(): Promise<any[]> {
  // Return cached database if still valid
  if (itemDatabaseCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return itemDatabaseCache;
  }

  try {
    // Fetch full item database from Arsha.io
    const url = `${BASE_URL}/util/db?lang=en`;
    console.log(`Fetching item database from ${url}...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Failed to fetch item database: ${response.status} ${response.statusText}`);
      return itemDatabaseCache || [];
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      itemDatabaseCache = data;
      cacheTimestamp = Date.now();
      console.log(`Loaded ${data.length} items into cache`);
      return data;
    }
    
    return [];
  } catch (error) {
    console.error("Error loading item database:", error);
    return itemDatabaseCache || [];
  }
}

export async function searchItems(query: string): Promise<SearchResult[]> {
  try {
    if (!query || query.length < 2) {
      return [];
    }

    const database = await loadItemDatabase();
    
    if (database.length === 0) {
      return [];
    }

    // Search locally in the cached database
    const query_lower = query.toLowerCase();
    const results = database
      .filter((item: any) => {
        const name = item.name || item.itemName || "";
        return name.toLowerCase().includes(query_lower) && item.id;
      })
      .slice(0, 15) // Limit to 15 results
      .map((item: any) => ({
        id: item.id,
        name: item.name || item.itemName,
        icon: `https://s1.pearlcdn.com/NAEU/TradeMarket/Common/img/BDO/item/${item.id}.png`,
      }));

    return results;
  } catch (error) {
    console.error("Error searching items:", error);
    return [];
  }
}
