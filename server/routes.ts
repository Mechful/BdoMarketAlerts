import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
  }
}
import { storage } from "./storage";
import { startBot, getClient } from "./bot";
import { getItemInfo } from "./bdo-api";
import { checkPrices } from "./price-monitor";
import { createTestAlertEmbed, sendWebhookMessage } from "./discord-embeds";

const SessionStore = MemoryStore(session);

// Load credentials from environment variables (stored securely in Secrets)
const VALID_USERNAME = process.env.BOT_USERNAME || "";
const VALID_PASSWORD = process.env.BOT_PASSWORD || "";

if (!VALID_USERNAME || !VALID_PASSWORD) {
  console.error("❌ ERROR: BOT_USERNAME and BOT_PASSWORD secrets are not set in Replit Secrets!");
  console.error("Please add them to your Secrets tab before trying to login.");
}
console.log("✓ Auth configured - Username length:", VALID_USERNAME.length, "Password length:", VALID_PASSWORD.length);

const addItemSchema = z.object({
  id: z.number().int().positive(),
  sid: z.number().int().min(0).max(20).default(0),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// Middleware to check if user is authenticated
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.authenticated) {
    next();
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup session middleware
  app.use(
    session({
      store: new SessionStore(),
      secret: process.env.SESSION_SECRET || "your-secret-key",
      resave: false,
      saveUninitialized: true,
      cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax', // Required for modern browsers to send cookies
      },
    })
  );

  // Login route
  app.post("/api/auth/login", (req, res) => {
    const result = loginSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: "Invalid request" });
    }
    
    const { username, password } = result.data;
    
    // Check if credentials match (use trim to remove any accidental whitespace)
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    
    if (trimmedUsername === VALID_USERNAME && trimmedPassword === VALID_PASSWORD) {
      req.session!.authenticated = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ error: "Invalid username or password" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    req.session?.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  // Check auth status
  app.get("/api/auth/status", (req, res) => {
    res.json({ authenticated: req.session?.authenticated || false });
  });

  startBot().catch((error) => {
    console.error("Discord bot not available:", error.message || error);
    console.log("Bot commands won't work, but webhook alerts and web interface will still function.");
  });

  // All protected routes require authentication
  app.use("/api/status", requireAuth);
  app.use("/api/items", requireAuth);
  app.use("/api/check-prices", requireAuth);
  app.use("/api/test-alert", requireAuth);

  app.get("/api/status", async (req, res) => {
    const client = getClient();
    const items = await storage.getTrackedItems();
    
    res.json({
      status: "online",
      botConnected: client !== null && client.isReady(),
      botUsername: client?.user?.tag || null,
      trackedItemsCount: items.length,
      region: process.env.BDO_REGION || "eu",
      checkIntervalMs: parseInt(process.env.PRICE_CHECK_INTERVAL_MS || "300000", 10),
    });
  });

  app.get("/api/items", async (req, res) => {
    try {
      const items = await storage.getTrackedItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  app.post("/api/items", async (req, res) => {
    try {
      const parseResult = addItemSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json({ 
          error: "Invalid request body", 
          details: parseResult.error.issues.map(i => i.message).join(", ")
        });
      }
      
      const { id, sid } = parseResult.data;
      
      const existing = await storage.getTrackedItem(id, sid);
      if (existing) {
        return res.status(409).json({ error: "Item already being tracked" });
      }
      
      const itemInfo = await getItemInfo(id, sid);
      if (!itemInfo) {
        return res.status(404).json({ error: "Item not found in marketplace" });
      }
      
      const item = await storage.addTrackedItem({
        id: itemInfo.id,
        sid: sid,
        name: itemInfo.name,
        lastPrice: itemInfo.lastSoldPrice,
        lastStock: itemInfo.currentStock,
        lastSoldTime: itemInfo.lastSoldTime,
      });
      
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding item:", error);
      res.status(500).json({ error: "Failed to add item" });
    }
  });

  app.delete("/api/items/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const sidParam = req.query.sid as string | undefined;
      const sid = sidParam ? parseInt(sidParam, 10) : undefined;
      
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      if (sidParam !== undefined && (isNaN(sid!) || sid! < 0)) {
        return res.status(400).json({ error: "Invalid sub ID" });
      }
      
      const removed = await storage.removeTrackedItem(id, sid);
      
      if (!removed) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error removing item:", error);
      res.status(500).json({ error: "Failed to remove item" });
    }
  });

  app.post("/api/check-prices", async (req, res) => {
    try {
      await checkPrices();
      res.json({ message: "Price check completed" });
    } catch (error) {
      console.error("Error checking prices:", error);
      res.status(500).json({ error: "Failed to check prices" });
    }
  });

  app.post("/api/test-alert", async (req, res) => {
    try {
      const embed = createTestAlertEmbed();
      const success = await sendWebhookMessage(embed);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to send test alert. Check that DISCORD_WEBHOOK_URL is set correctly." });
      }
      
      res.json({ message: "Test alert sent successfully!" });
    } catch (error) {
      console.error("Error sending test alert:", error);
      res.status(500).json({ error: "Failed to send test alert" });
    }
  });

  // Search items by name
  app.get("/api/search-items", async (req, res) => {
    try {
      const query = (req.query.q as string || "").toLowerCase().trim();
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      // Get list of common BDO items that users might search for
      // This is a curated list of popular marketplace items
      const commonItems = [
        { id: 10007, name: "Iron Ore" },
        { id: 10008, name: "Copper Ore" },
        { id: 10009, name: "Tin Ore" },
        { id: 10010, name: "Zinc Ore" },
        { id: 10017, name: "Black Stone (Weapon)" },
        { id: 10018, name: "Black Stone (Armor)" },
        { id: 10019, name: "Concentrated Magical Black Stone" },
        { id: 10020, name: "Concentrated Magical Black Stone (Armor)" },
        { id: 10026, name: "Fragment of Weapon" },
        { id: 10027, name: "Fragment of Armor" },
        { id: 10032, name: "Elion's Tear" },
        { id: 10033, name: "Memories of Elion" },
        { id: 10035, name: "Clear Liquid Reagent" },
        { id: 10047, name: "Purified Water" },
        { id: 10108, name: "Fine Magical Dust" },
        { id: 10109, name: "Coarse Magical Dust" },
        { id: 10110, name: "Precision Magical Dust" },
        { id: 10116, name: "Hard Black Crystal" },
        { id: 10117, name: "Sharp Black Crystal" },
        { id: 11607, name: "Ancient Stone" },
        { id: 11612, name: "Spirit Stone" },
        { id: 11615, name: "Flaming Feather" },
        { id: 11616, name: "Windy Wind Stone" },
        { id: 11617, name: "Dry Distilled Water" },
        { id: 11618, name: "Purified Gem Powder" },
        { id: 12066, name: "Godr's Shard" },
        { id: 12067, name: "Devilsaur Tooth" },
        { id: 12068, name: "Basilisk's Crystal" },
        { id: 12069, name: "Centaur's Hoof" },
        { id: 12070, name: "Mansha's Claw" },
        { id: 12205, name: "Dragon Scale Fossil" },
        { id: 15001, name: "Boiled Egg" },
        { id: 15002, name: "Balenos Meal" },
        { id: 15003, name: "Wheat Bread" },
        { id: 15004, name: "Node Manager's Recommendation" },
        { id: 15005, name: "Mediah Meal" },
        { id: 15006, name: "Calpheon Meal" },
        { id: 15007, name: "Valencia Meal" },
        { id: 16002, name: "Witch's Earring" },
        { id: 16003, name: "Bheg's Ring" },
        { id: 16004, name: "Elkarr's Seal" },
        { id: 16005, name: "Ogre Ring" },
        { id: 16006, name: "Crescent Ring" },
        { id: 16007, name: "Red Coral Earring" },
        { id: 16008, name: "Blue Coral Ring" },
      ];

      // Filter items that match the search query
      const results = commonItems
        .filter(item => item.name.toLowerCase().includes(query))
        .slice(0, 10); // Limit to 10 results
      
      res.json(results);
    } catch (error) {
      console.error("Error searching items:", error);
      res.status(500).json({ error: "Failed to search items" });
    }
  });

  return httpServer;
}
