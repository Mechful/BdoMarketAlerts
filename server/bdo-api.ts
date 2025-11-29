import type { BdoItemInfo } from "@shared/schema";

const BASE_URL = "https://api.arsha.io";
const DEFAULT_REGION = process.env.BDO_REGION || "eu";

export async function getItemInfo(id: number, sid: number = 0, region: string = DEFAULT_REGION): Promise<BdoItemInfo | null> {
  try {
    const url = `${BASE_URL}/v2/${region}/item?id=${id}&lang=en`;
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
    return `${minutes}m ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diff / 86400);
    return `${days}d ago`;
  }
}

export function getItemIconUrl(id: number): string {
  return `https://s1.pearlcdn.com/NAEU/TradeMarket/Common/img/BDO/item/${id}.png`;
}

export function getEnhancementLabel(sid: number): string {
  if (sid === 0) return "";
  if (sid <= 15) return ` (+${sid})`;
  
  const labels: { [key: number]: string } = {
    16: " (PRI)",
    17: " (DUO)",
    18: " (TRI)",
    19: " (TET)",
    20: " (PEN)",
  };
  
  return labels[sid] || ` (+${sid})`;
}

export interface SearchResult {
  id: number;
  name: string;
  icon: string;
  supportsEnhancement: boolean;
  itemType: 'accessory' | 'equipment' | 'other';
  maxEnhancement: number;
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

function getItemType(itemName: string): 'accessory' | 'equipment' | 'other' {
  const lowerName = itemName.toLowerCase();
  
  // Check for accessories
  const accessoryKeywords = ['ring', 'earring', 'necklace', 'belt', 'bracelet', 'brooch'];
  if (accessoryKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'accessory';
  }
  
  // Check for equipment
  const equipmentKeywords = ['sword', 'dagger', 'axe', 'mace', 'spear', 'bow', 'staff', 'armor', 'helmet', 'chest', 'gloves', 'legs', 'boots', 'shield', 'helm', 'plate', 'gauntlets'];
  if (equipmentKeywords.some(keyword => lowerName.includes(keyword))) {
    return 'equipment';
  }
  
  return 'other';
}

function getMaxEnhancementLevel(itemName: string, itemType: 'accessory' | 'equipment' | 'other'): number {
  const lowerName = itemName.toLowerCase();
  
  // Preonne accessories: base to +10 (0-10)
  if (lowerName.includes('preonne')) {
    return 10;
  }
  
  // Special 4 pieces: base to +5 (0-5)
  const specialPieces = ["dahn's gloves", "ator's shoes", "fallen god's armor", "labreska's helmet"];
  if (specialPieces.some(piece => lowerName.includes(piece))) {
    return 5;
  }
  
  // Accessories: base to PEN (0-20)
  if (itemType === 'accessory') {
    return 20;
  }
  
  // Krogdalo gear: base to +10 (0-10)
  if (lowerName.includes('krogdalo')) {
    return 10;
  }
  
  // Default equipment: base to +15 (0-15)
  if (itemType === 'equipment') {
    return 15;
  }
  
  return 0;
}

function canItemBeEnhanced(itemName: string, itemId: number, maxEnhance: number): boolean {
  // If Arsha API provides maxEnhance > 0, trust that
  if (maxEnhance > 0) {
    return true;
  }
  
  const itemType = getItemType(itemName);
  if (itemType !== 'other') {
    return true;
  }
  
  // Weapons and armor typically support enhancements (exclude materials)
  const enhancementBlocklist = ['ore', 'stone', 'shard', 'crystal', 'powder', 'fragment', 'hide', 'blood', 'leather', 'ingot', 'wood', 'timber', 'plywood', 'flux', 'ash', 'elixir', 'essence', 'poison'];
  
  if (enhancementBlocklist.some(keyword => itemName.toLowerCase().includes(keyword))) {
    return false;
  }
  
  return false;
}

export async function searchItems(query: string, region: string = DEFAULT_REGION): Promise<SearchResult[]> {
  try {
    if (!query || query.length < 2) {
      return [];
    }

    // Use BlackDesertMarket API for search - returns only marketplace-tradeable items
    // API endpoint: GET /search/{search} with query parameters for region and language
    const regionParam = region.toLowerCase() === 'eu' ? 'eu' : 'na';
    const url = `https://api.blackdesertmarket.com/search/${encodeURIComponent(query)}?region=${regionParam}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`BlackDesertMarket search error: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const apiResponse = await response.json();
    
    if (!apiResponse.data || !Array.isArray(apiResponse.data)) {
      return [];
    }

    // Map results to our format
    const results = await Promise.all(
      apiResponse.data
        .slice(0, 15) // Limit to 15 results
        .map(async (item: any) => {
          // Fetch item info to determine if it supports enhancement
          const itemInfo = await getItemInfo(item.id, 0, region);
          const maxEnhance = itemInfo ? (itemInfo.maxEnhance || 0) : 0;
          const supportsEnhancement = canItemBeEnhanced(item.name, item.id, maxEnhance);
          const itemType = getItemType(item.name);
          const maxEnhancementLevel = getMaxEnhancementLevel(item.name, itemType);
          
          return {
            id: item.id,
            name: item.name,
            icon: `https://s1.pearlcdn.com/NAEU/TradeMarket/Common/img/BDO/item/${item.id}.png`,
            supportsEnhancement,
            itemType,
            maxEnhancement: maxEnhancementLevel,
          };
        })
    );

    return results;
  } catch (error) {
    console.error("Error searching items:", error);
    return [];
  }
}
