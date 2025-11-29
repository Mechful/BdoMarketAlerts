# BDO Marketplace Price Monitor

## Overview

A Discord bot and web application that monitors Black Desert Online (BDO) marketplace prices and sends alerts when prices change. The system tracks specified items from the BDO marketplace API and notifies users via Discord webhooks when price increases or decreases are detected. It features both Discord bot commands for item management and a React-based web interface for monitoring tracked items with full persistent database storage.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component Library**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling

**State Management**: TanStack Query (React Query) for server state management and data fetching

**Routing**: Wouter for lightweight client-side routing

**Design System**: Custom Tailwind configuration with CSS variables for theming, following a "new-york" style variant from Shadcn/ui

**Authentication**: Session-based authentication with express-session and MemoryStore

**Rationale**: The combination of Shadcn/ui and Radix UI provides accessible, customizable components while Tailwind enables rapid styling. TanStack Query handles caching and synchronization of server data, eliminating the need for complex state management libraries.

### Backend Architecture

**Runtime**: Node.js with TypeScript using ESM modules

**Web Framework**: Express.js for HTTP server and REST API endpoints

**Discord Integration**: Discord.js v14 for bot functionality and webhook messaging

**External APIs**: 
- Arsha.io for BDO marketplace price data
- BlackDesertMarket API for item search (returns only tradeable items)

**Build Process**: esbuild for server bundling with selective dependency bundling to optimize cold start times

**Storage Layer**: Database-backed storage using PostgreSQL with Drizzle ORM for type-safe queries

**Database**: PostgreSQL (Neon serverless) with Drizzle ORM and drizzle-kit for migrations

**Session Management**: express-session with MemoryStore for development authentication

**Rationale**: Express provides a minimal, flexible foundation for the API. Discord.js is the standard library for Discord bot development. Drizzle ORM provides type safety and easy migrations. PostgreSQL ensures data persistence across app restarts.

### Core Features

**Price Monitoring System**: 
- Periodic polling of BDO marketplace API for tracked items
- Configurable check interval via environment variable (default: 5 minutes)
- Price change detection and alert generation
- Discord webhook notifications with formatted embeds
- Persistent database storage of tracked items

**Authentication & Security**:
- Login protection with username/password (stored in Replit Secrets)
- Session-based authentication persists across requests
- Rate limiting on login attempts (5 attempts per 15 minutes)
- User sessions stored in-memory during app runtime

**Discord Bot Commands** (requires DISCORD_BOT_TOKEN):
- `!add <id> [sid]` - Track a new marketplace item
- `!remove <id> [sid]` - Stop tracking an item
- `!list` - Display all tracked items
- `!help` - Show available commands

Note: Discord commands require a Discord Bot Token. The web interface provides full functionality without a bot token.

**Web Interface**:
- Real-time status dashboard showing bot connection and tracked items
- Item management (add/remove tracking)
- Manual price check triggering
- Display of current prices, stock levels, and last sold times
- Item search by name using BlackDesertMarket API
- Protected routes requiring authentication
- Responsive design with light/dark mode support

### Data Models

**TrackedItem Schema** (PostgreSQL):
- `id`: Auto-increment primary key (serial)
- `itemId`: Item identifier from BDO marketplace
- `sid`: Sub-identifier (enhancement level, 0-20)
- `name`: Item name
- `lastPrice`: Last recorded price
- `lastStock`: Current stock quantity
- `lastSoldTime`: Timestamp of last sale
- `addedAt`: Timestamp when tracking started

**Price Alert Schema**:
- References tracked item
- Old and new price values
- Price change direction (increase/decrease)
- Current stock and last sold time

### Discord Integration Design

**Authentication**: Discord OAuth via Replit Connectors with automatic token refresh

**Message Design**: All Discord interactions use native embed format following Discord's design patterns:
- Color-coded embeds (green for price increases, red for decreases)
- Thumbnail display using BDOCodex item icons
- Two-column field layout for price/stock data
- Timestamps on all alerts

**Webhook vs Bot Messages**: System uses webhooks for price alerts to avoid rate limits, while bot commands provide interactive item management

### External Dependencies

**BDO Marketplace APIs**:
- Arsha.io: Reliable price data
  - Base URL: `https://api.arsha.io`
  - Endpoints: `/v2/{region}/item` for item info, `/v2/{region}/history` for price history
  - Region configurable via environment variable (default: EU)
- BlackDesertMarket: Item search for tradeable items
  - Base URL: `https://api.blackdesertmarket.com`
  - Returns only marketplace-tradeable items

**Discord**:
- Discord.js library for bot functionality
- Replit Discord Connector for OAuth and token management
- Webhook URLs for alert delivery

**Database**:
- PostgreSQL (Neon serverless)
- Drizzle ORM for type-safe queries
- drizzle-kit for migrations

### Configuration

**Environment Variables**:
- `DISCORD_WEBHOOK_URL`: Discord webhook URL for price alerts (required for webhook functionality)
- `DISCORD_BOT_TOKEN`: Discord bot token for command handling (optional)
- `BDO_REGION`: Marketplace region (default: "eu")
- `PRICE_CHECK_INTERVAL_MS`: Polling frequency (default: 300000ms = 5 minutes)
- `DATABASE_URL`: PostgreSQL connection string (auto-configured on Replit)
- `SESSION_SECRET`: Session encryption secret (stored in Replit Secrets)
- `BOT_USERNAME`: Login username (stored in Replit Secrets)
- `BOT_PASSWORD`: Login password (stored in Replit Secrets)

**Build Configuration**:
- Separate client and server builds
- Server bundles allowlisted dependencies to reduce file system calls
- Client builds to `dist/public`, server to `dist/index.cjs`
- Vite configured with custom asset alias (`@assets`) for accessing attached images

### Recent Changes (Session 2)

**Database Persistence Implementation**:
- Replaced in-memory storage (MemStorage) with PostgreSQL-backed storage
- Created Drizzle ORM schema for tracked items in `shared/schema.ts`
- Implemented DatabaseStorage class with full CRUD operations
- Set up database migrations with drizzle-kit
- Added error handling in storage layer to gracefully handle database issues

**Authentication Session Fixes**:
- Fixed session persistence issues by configuring express-session properly
- Enabled session resave to ensure sessions persist across requests
- Configured sameSite cookie policy to allow proper session transmission
- Tracked items now survive app restarts and closures

**Frontend Updates**:
- Updated TrackedItem interface to match new database schema (added itemId field)
- Fixed remove item mutation to use correct field names
- Aligned all database field references throughout the codebase

**Asset Management**:
- Configured custom coin image (Coin_80x80.png) on login and home pages
- Set up @assets alias in vite.config.ts for image imports

### Known Limitations & Notes

- **Startup Database Error**: Neon serverless driver shows a benign error when checking for items on empty database at startup, but app continues normally
- **Discord Commands**: Only available when DISCORD_BOT_TOKEN is set; web interface provides all functionality
- **No Publishing Costs**: App runs on Replit when browser is open; user cannot afford paid publishing
- **Session Storage**: Sessions stored in memory; lost when app restarts (user data in database persists)

### Technical Decisions

**Separation of Concerns**: Item search uses BlackDesertMarket API (returns only tradeable items), while price monitoring uses Arsha.io API (reliable price data with history).

**Rate Limiting**: In-memory rate limiter for login attempts prevents brute force attacks without requiring database overhead.

**Error Handling**: All database operations wrapped in try-catch blocks to gracefully handle connection issues and prevent app crashes.

**Asset Imports**: Custom images referenced through vite.config.ts @assets alias for clean imports and asset management.
