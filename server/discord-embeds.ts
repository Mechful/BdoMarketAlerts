import type { TrackedItem, PriceAlert, BdoItemInfo } from "@shared/schema";
import { formatSilver, formatRelativeTime, getItemIconUrl, getEnhancementLabel } from "./bdo-api";

const COLORS = {
  SUCCESS: 0x57F287,
  ERROR: 0xED4245,
  INFO: 0x5865F2,
  PRICE_INCREASE: 0x57F287,
  PRICE_DECREASE: 0xED4245,
};

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  thumbnail?: {
    url: string;
  };
  footer?: {
    text: string;
  };
  timestamp?: string;
}

export function createPriceAlertEmbed(alert: PriceAlert, region: string = "eu"): DiscordEmbed {
  const isIncrease = alert.priceChange === "increase";
  const arrow = isIncrease ? "Price increase" : "Price decrease";
  const itemName = alert.item.name + getEnhancementLabel(alert.item.sid);
  const regionLabel = region.toUpperCase();
  
  return {
    title: `"${itemName}" ${regionLabel} - ${arrow}`,
    color: isIncrease ? COLORS.PRICE_INCREASE : COLORS.PRICE_DECREASE,
    thumbnail: {
      url: getItemIconUrl(alert.item.id),
    },
    fields: [
      {
        name: "New Price",
        value: formatSilver(alert.newPrice),
        inline: true,
      },
      {
        name: "Old Price",
        value: formatSilver(alert.oldPrice),
        inline: true,
      },
      {
        name: "Stock",
        value: alert.stock.toString(),
        inline: true,
      },
      {
        name: "Last Sold",
        value: formatRelativeTime(alert.lastSoldTime),
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

export function createItemAddedEmbed(item: BdoItemInfo): DiscordEmbed {
  const itemName = item.name + getEnhancementLabel(item.sid);
  
  return {
    title: "Item Added",
    description: `Now tracking **${itemName}**\n(ID: ${item.id}, SID: ${item.sid})`,
    color: COLORS.SUCCESS,
    thumbnail: {
      url: getItemIconUrl(item.id),
    },
    fields: [
      {
        name: "Current Price",
        value: formatSilver(item.lastSoldPrice),
        inline: true,
      },
      {
        name: "Stock",
        value: item.currentStock.toString(),
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

export function createItemRemovedEmbed(itemName: string, id: number): DiscordEmbed {
  return {
    title: "Item Removed",
    description: `Stopped tracking **${itemName}**`,
    color: COLORS.INFO,
    timestamp: new Date().toISOString(),
  };
}

export function createItemListEmbed(items: TrackedItem[]): DiscordEmbed {
  if (items.length === 0) {
    return {
      title: "Tracked Items (0)",
      description: "No items tracked. Use `!add <id> [sid]` to start tracking items.",
      color: COLORS.INFO,
      timestamp: new Date().toISOString(),
    };
  }
  
  const fields = items.slice(0, 25).map((item) => ({
    name: item.name + getEnhancementLabel(item.sid),
    value: `Price: ${formatSilver(item.lastPrice)}\nStock: ${item.lastStock}\nID: ${item.id}, SID: ${item.sid}`,
    inline: true,
  }));
  
  return {
    title: `Tracked Items (${items.length})`,
    color: COLORS.INFO,
    fields,
    footer: items.length > 25 ? { text: `Showing 25 of ${items.length} items` } : undefined,
    timestamp: new Date().toISOString(),
  };
}

export function createErrorEmbed(message: string): DiscordEmbed {
  return {
    title: "Error",
    description: message,
    color: COLORS.ERROR,
    timestamp: new Date().toISOString(),
  };
}

export function createHelpEmbed(): DiscordEmbed {
  return {
    title: "BDO Market Bot - Commands",
    description: "Monitor Black Desert Online marketplace prices and get alerts when prices change.",
    color: COLORS.INFO,
    fields: [
      {
        name: "!add <id> [sid]",
        value: "Add an item to your watchlist.\n`id` = Item ID (required)\n`sid` = Sub ID/Enhancement level (default: 0)\nExample: `!add 10007 0`",
        inline: false,
      },
      {
        name: "!remove <id> [sid]",
        value: "Remove an item from your watchlist.\nExample: `!remove 10007`",
        inline: false,
      },
      {
        name: "!list",
        value: "Show all tracked items with current prices.",
        inline: false,
      },
      {
        name: "!help",
        value: "Show this help message.",
        inline: false,
      },
    ],
    footer: {
      text: "Prices are checked every 5 minutes",
    },
    timestamp: new Date().toISOString(),
  };
}

export function createTestAlertEmbed(region: string = "eu"): DiscordEmbed {
  const regionLabel = region.toUpperCase();
  return {
    title: `"Seleth Longsword" ${regionLabel} - Price increase`,
    description: "Test alert to verify webhook connection",
    color: COLORS.PRICE_INCREASE,
    thumbnail: {
      url: getItemIconUrl(10007),
    },
    fields: [
      {
        name: "New Price",
        value: formatSilver(1500000),
        inline: true,
      },
      {
        name: "Old Price",
        value: formatSilver(1428500),
        inline: true,
      },
      {
        name: "Stock",
        value: "1",
        inline: true,
      },
      {
        name: "Last Sold",
        value: "Just now",
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };
}

export async function sendWebhookMessage(embed: DiscordEmbed): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error("DISCORD_WEBHOOK_URL not configured");
    return false;
  }
  
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });
    
    if (!response.ok) {
      console.error(`Webhook error: ${response.status} ${response.statusText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error sending webhook message:", error);
    return false;
  }
}
