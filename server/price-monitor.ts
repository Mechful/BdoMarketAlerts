import { storage } from "./storage";
import { getItemInfo } from "./bdo-api";
import { createPriceAlertEmbed, sendWebhookMessage } from "./discord-embeds";
import type { PriceAlert, TrackedItem } from "@shared/schema";

let monitorInterval: NodeJS.Timeout | null = null;

export async function checkPrices(): Promise<void> {
  const items = await storage.getTrackedItems();
  
  if (!items || items.length === 0) {
    return;
  }
  
  console.log(`Checking prices for ${items.length} items...`);
  
  for (const item of items) {
    try {
      const currentInfo = await getItemInfo(item.itemId, item.sid);
      
      if (!currentInfo) {
        console.log(`Could not fetch info for item ${item.itemId}:${item.sid}`);
        continue;
      }
      
      const oldPrice = item.lastPrice;
      const newPrice = currentInfo.lastSoldPrice;
      
      if (oldPrice !== newPrice && oldPrice > 0) {
        const priceChange: "increase" | "decrease" = newPrice > oldPrice ? "increase" : "decrease";
        
        const alert: PriceAlert = {
          item: {
            itemId: item.itemId,
            sid: item.sid,
            name: currentInfo.name || item.name,
            lastPrice: newPrice,
            lastStock: currentInfo.currentStock,
            lastSoldTime: currentInfo.lastSoldTime,
          },
          oldPrice,
          newPrice,
          priceChange,
          stock: currentInfo.currentStock,
          lastSoldTime: currentInfo.lastSoldTime,
        };
        
        console.log(`Price ${priceChange} detected for ${item.name}: ${oldPrice} -> ${newPrice}`);
        
        const embed = createPriceAlertEmbed(alert);
        await sendWebhookMessage(embed);
      }
      
      await storage.updateTrackedItem(item.itemId, item.sid, {
        lastPrice: newPrice,
        lastStock: currentInfo.currentStock,
        lastSoldTime: currentInfo.lastSoldTime,
        name: currentInfo.name || item.name,
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error checking price for item ${item.itemId}:${item.sid}:`, error);
    }
  }
  
  console.log("Price check completed");
}

export function startPriceMonitor(): void {
  const intervalMs = parseInt(process.env.PRICE_CHECK_INTERVAL_MS || "300000", 10);
  
  console.log(`Starting price monitor with ${intervalMs / 1000}s interval`);
  
  checkPrices();
  
  monitorInterval = setInterval(() => {
    checkPrices();
  }, intervalMs);
}

export function stopPriceMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("Price monitor stopped");
  }
}
