# Discord Bot Message Design Guidelines

## Design Approach
**Discord-Native Design**: All interfaces are Discord embeds and messages following Discord's native design patterns. The bot should feel like a natural extension of Discord's UI.

## Core Message Types

### 1. Price Alert Embeds (Primary Feature)
**Layout Structure:**
- **Thumbnail**: Item icon (64x64px) from BDOCodex positioned top-right
- **Title**: Item name in bold
- **Color Coding**: 
  - Green (#00FF00 or #57F287) for price increases
  - Red (#FF0000 or #ED4245) for price decreases
- **Fields Layout** (2-column grid):
  - Left column: "Current Price", "Stock"
  - Right column: "Previous Price", "Last Sold"
- **Footer**: Timestamp showing when the change was detected

**Typography:**
- Title: Discord's default embed title (bold, ~16px equivalent)
- Field labels: Discord's default field name style (bold)
- Field values: Discord's default field value style (regular weight)
- All prices: Format with thousand separators (e.g., "1,234,567")

**Content Structure:**
```
[Item Icon - top right]
📈 Kzarka Longsword (+0)

Current Price: 48,500 Silver
Previous Price: 46,100 Silver
Stock: 20 items
Last Sold: 2 hours ago
```

### 2. Command Response Messages
**!add command success:**
- Simple green-colored embed
- Title: "✅ Item Added"
- Description: "Now tracking [Item Name] (ID: XXXXX, SID: X)"

**!remove command success:**
- Simple blue-colored embed  
- Title: "🗑️ Item Removed"
- Description: "Stopped tracking [Item Name]"

**!list command:**
- Blue-colored embed
- Title: "📋 Tracked Items (X)"
- Field per item showing: Name, Current Price, Stock
- If empty: "No items tracked. Use !add to start tracking items."

**Error messages:**
- Red-colored embed
- Title: "❌ Error"
- Description: Clear explanation of what went wrong

## Visual Specifications

### Colors
- Success/Price Increase: `#57F287` (Discord green)
- Error/Price Decrease: `#ED4245` (Discord red)
- Info/Neutral: `#5865F2` (Discord blurple)

### Icons & Images
- Item thumbnails: BDOCodex icons at 64x64px
- Emoji indicators: 📈 (increase), 📉 (decrease), ✅ (success), ❌ (error), 📋 (list), 🗑️ (remove)

### Spacing & Layout
- Use Discord's native embed padding (no customization needed)
- Inline fields for two-column layouts
- Non-inline fields for full-width information

## Message Formatting

### Number Formatting
- All silver amounts: Thousand separators (1,234,567)
- Percentages: Show change magnitude when significant (e.g., "+5.2%")

### Time Formatting
- Use relative time for "Last Sold" (e.g., "2 hours ago", "5 minutes ago", "3 days ago")
- Use absolute timestamps in footer (Discord auto-formats these)

### Item Names
- Include enhancement level in parentheses: "Kzarka Longsword (+15)"
- Base items (enhancement 0): "Kzarka Longsword (+0)"

## Interaction Patterns

### Commands
- Prefix: `!` (exclamation mark)
- Format: `!command [arguments]`
- Examples:
  - `!add 10007 0` - Add item with ID 10007, sub-ID 0
  - `!remove 10007` - Remove item 10007
  - `!list` - Show all tracked items

### Response Timing
- Immediate acknowledgment for commands (<1 second)
- Price alerts sent to dedicated channel when changes detected
- Background checks every 5 minutes (silent, no spam)

## Quality Standards
- **Clarity**: Every message should be immediately understandable
- **Consistency**: Use same embed structure for similar message types
- **Responsiveness**: Instant feedback for all user commands
- **Polish**: Proper formatting, no truncated text, all data displayed cleanly