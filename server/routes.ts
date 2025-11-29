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
import { getItemInfo, searchItems } from "./bdo-api";
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

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5; // 5 attempts per window

function getRateLimitKey(req: Request): string {
  // Use IP address as the rate limit key
  return (req.ip || req.socket.remoteAddress || "unknown") as string;
}

function isRateLimited(req: Request): boolean {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt) {
    loginAttempts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  // Reset if window has expired
  if (now > attempt.resetTime) {
    loginAttempts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return false;
  }

  // Check if limit exceeded
  if (attempt.count >= MAX_ATTEMPTS) {
    return true;
  }

  // Increment counter
  attempt.count++;
  return false;
}

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
    // Check rate limit first
    if (isRateLimited(req)) {
      return res.status(429).json({ 
        error: "Too many login attempts. Please wait 15 minutes before trying again." 
      });
    }

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
      // Explicitly save the session
      req.session!.save((err) => {
        if (err) {
          console.error("Error saving session:", err);
          return res.status(500).json({ error: "Login failed" });
        }
        // Clear rate limit on successful login
        loginAttempts.delete(getRateLimitKey(req));
        res.json({ success: true });
      });
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
        itemId: itemInfo.id,
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
      const query = req.query.q as string;
      
      if (!query) {
        return res.json([]);
      }
      
      const results = await searchItems(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching items:", error);
      res.status(500).json({ error: "Failed to search items" });
    }
  });

  return httpServer;
}
