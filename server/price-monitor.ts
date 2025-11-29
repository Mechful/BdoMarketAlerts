import { storage } from "./storage";
import { getItemInfo } from "./bdo-api";
import { createPriceAlertEmbed, sendWebhookMessage } from "./discord-embeds";
import type { PriceAlert, TrackedItem } from "@shared/schema";

let monitorInterval: NodeJS.Timeout | null = null;

export async function checkPrices(region: string = "eu"): Promise<void> {
  const items = await storage.getTrackedItems(region);
  
  if (items.length === 0) {
    console.log(`No items to check for ${region.toUpperCase()}`);
    return;
  }
  
  console.log(`Checking prices for ${items.length} items in ${region.toUpperCase()}...`);
  
  for (const item of items) {
    try {
      const currentInfo = await getItemInfo(item.id, item.sid, region);
      
      if (!currentInfo) {
        console.log(`Could not fetch info for item ${item.id}:${item.sid}`);
        continue;
      }
      
      const oldPrice = item.lastPrice;
      const newPrice = currentInfo.lastSoldPrice;
      
      if (oldPrice !== newPrice && oldPrice > 0) {
        const priceChange: "increase" | "decrease" = newPrice > oldPrice ? "increase" : "decrease";
        
        const alert: PriceAlert = {
          item: {
            ...item,
            name: currentInfo.name || item.name,
          },
          oldPrice,
          newPrice,
          priceChange,
          stock: currentInfo.currentStock,
          lastSoldTime: currentInfo.lastSoldTime,
        };
        
        console.log(`Price ${priceChange} detected for ${item.name}: ${oldPrice} -> ${newPrice}`);
        
        const embed = createPriceAlertEmbed(alert, region);
        await sendWebhookMessage(embed);
      }
      
      await storage.updateTrackedItem(item.id, item.sid, {
        lastPrice: newPrice,
        lastStock: currentInfo.currentStock,
        lastSoldTime: currentInfo.lastSoldTime,
        name: currentInfo.name || item.name,
      }, region);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error checking price for item ${item.id}:${item.sid}:`, error);
    }
  }
  
  console.log(`Price check completed for ${region.toUpperCase()}`);
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
