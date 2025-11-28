# BDO Marketplace Price Monitor

## Overview

A Discord bot and web application that monitors Black Desert Online (BDO) marketplace prices and sends alerts when prices change. The system tracks specified items from the BDO marketplace API and notifies users via Discord webhooks when price increases or decreases are detected. It features both Discord bot commands for item management and a React-based web interface for monitoring tracked items.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool

**UI Component Library**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling

**State Management**: TanStack Query (React Query) for server state management and data fetching

**Routing**: Wouter for lightweight client-side routing

**Design System**: Custom Tailwind configuration with CSS variables for theming, following a "new-york" style variant from Shadcn/ui

**Rationale**: The combination of Shadcn/ui and Radix UI provides accessible, customizable components while Tailwind enables rapid styling. TanStack Query handles caching and synchronization of server data, eliminating the need for complex state management libraries.

### Backend Architecture

**Runtime**: Node.js with TypeScript using ESM modules

**Web Framework**: Express.js for HTTP server and REST API endpoints

**Discord Integration**: Discord.js v14 for bot functionality and webhook messaging

**External API**: Arsha.io API for BDO marketplace data retrieval

**Build Process**: esbuild for server bundling with selective dependency bundling to optimize cold start times

**Storage Layer**: Abstracted storage interface with in-memory implementation (MemStorage), designed to be replaceable with database-backed storage

**Rationale**: Express provides a minimal, flexible foundation for the API. Discord.js is the standard library for Discord bot development. The abstracted storage pattern allows easy migration from in-memory to persistent storage (likely PostgreSQL via Drizzle ORM based on configuration files).

### Core Features

**Price Monitoring System**: 
- Periodic polling of BDO marketplace API for tracked items
- Configurable check interval via environment variable (default: 5 minutes)
- Price change detection and alert generation
- Discord webhook notifications with formatted embeds

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

### Data Models

**TrackedItem Schema**:
- `id`: Item identifier from BDO marketplace
- `sid`: Sub-identifier (enhancement level)
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

**BDO Marketplace API** (Arsha.io):
- Base URL: `https://api.arsha.io`
- Endpoints: `/v2/{region}/item` for item info, `/v2/{region}/history` for price history
- Region configurable via environment variable (default: EU)
- No authentication required

**Discord**:
- Discord.js library for bot functionality
- Replit Discord Connector for OAuth and token management
- Webhook URLs for alert delivery

**Database** (Configured but not yet implemented):
- Drizzle ORM configured for PostgreSQL
- Neon serverless PostgreSQL driver
- Migration system in place (`drizzle-kit`)
- Currently using in-memory storage as placeholder

**Design Rationale**: The system is architected to migrate from in-memory storage to PostgreSQL. Drizzle configuration exists with schema definitions, but actual database operations use the MemStorage implementation. This allows development without database provisioning while maintaining a clean migration path.

### Configuration

**Environment Variables**:
- `DISCORD_WEBHOOK_URL`: Discord webhook URL for price alerts (required)
- `BDO_REGION`: Marketplace region (default: "eu")
- `PRICE_CHECK_INTERVAL_MS`: Polling frequency (default: 300000ms = 5 minutes)
- `DISCORD_BOT_TOKEN`: Discord bot token for command handling (optional)
- Discord authentication via Replit Connectors (automatic)

**Build Configuration**:
- Separate client and server builds
- Server bundles allowlisted dependencies to reduce file system calls
- Client builds to `dist/public`, server to `dist/index.cjs`