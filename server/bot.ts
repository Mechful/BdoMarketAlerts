import { Client, Message } from 'discord.js';
import { getDiscordClient, convertToDiscordEmbed } from './discord-client';
import { storage } from './storage';
import { getItemInfo } from './bdo-api';
import {
  createItemAddedEmbed,
  createItemRemovedEmbed,
  createItemListEmbed,
  createErrorEmbed,
  createHelpEmbed,
} from './discord-embeds';
import { startPriceMonitor } from './price-monitor';

const COMMAND_PREFIX = '!';

async function handleAddCommand(message: Message, args: string[]): Promise<void> {
  if (args.length < 1) {
    const embed = createErrorEmbed('Please provide an item ID.\nUsage: `!add <id> [sid]`\nExample: `!add 10007 0`');
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
    return;
  }
  
  const id = parseInt(args[0], 10);
  const sid = args.length > 1 ? parseInt(args[1], 10) : 0;
  
  if (isNaN(id)) {
    const embed = createErrorEmbed('Invalid item ID. Please provide a valid number.');
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
    return;
  }
  
  if (isNaN(sid)) {
    const embed = createErrorEmbed('Invalid sub ID. Please provide a valid number.');
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
    return;
  }
  
  const existing = await storage.getTrackedItem(id, sid);
  if (existing) {
    const embed = createErrorEmbed(`Item ${existing.name} (ID: ${id}, SID: ${sid}) is already being tracked.`);
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
    return;
  }
  
  const itemInfo = await getItemInfo(id, sid);
  if (!itemInfo) {
    const embed = createErrorEmbed(`Could not find item with ID ${id} and SID ${sid}. Please verify the item exists in the marketplace.`);
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
    return;
  }
  
  await storage.addTrackedItem({
    id: itemInfo.id,
    sid: sid,
    name: itemInfo.name,
    lastPrice: itemInfo.lastSoldPrice,
    lastStock: itemInfo.currentStock,
    lastSoldTime: itemInfo.lastSoldTime,
  });
  
  const embed = createItemAddedEmbed(itemInfo);
  await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
}

async function handleRemoveCommand(message: Message, args: string[]): Promise<void> {
  if (args.length < 1) {
    const embed = createErrorEmbed('Please provide an item ID.\nUsage: `!remove <id> [sid]`');
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
    return;
  }
  
  const id = parseInt(args[0], 10);
  const sid = args.length > 1 ? parseInt(args[1], 10) : undefined;
  
  if (isNaN(id)) {
    const embed = createErrorEmbed('Invalid item ID. Please provide a valid number.');
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
    return;
  }
  
  let itemName = `Item ${id}`;
  if (sid !== undefined) {
    const item = await storage.getTrackedItem(id, sid);
    if (item) itemName = item.name;
  } else {
    const items = await storage.getTrackedItems();
    const matchingItem = items.find(i => i.id === id);
    if (matchingItem) itemName = matchingItem.name;
  }
  
  const removed = await storage.removeTrackedItem(id, sid);
  
  if (!removed) {
    const embed = createErrorEmbed(`Item with ID ${id}${sid !== undefined ? ` and SID ${sid}` : ''} is not being tracked.`);
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
    return;
  }
  
  const embed = createItemRemovedEmbed(itemName, id);
  await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
}

async function handleListCommand(message: Message): Promise<void> {
  const items = await storage.getTrackedItems();
  const embed = createItemListEmbed(items);
  await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
}

async function handleHelpCommand(message: Message): Promise<void> {
  const embed = createHelpEmbed();
  await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
}

async function handleMessage(message: Message): Promise<void> {
  if (message.author.bot) return;
  
  if (!message.content.startsWith(COMMAND_PREFIX)) return;
  
  const args = message.content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  
  console.log(`Received command: ${command} with args: ${args.join(', ')}`);
  
  try {
    switch (command) {
      case 'add':
        await handleAddCommand(message, args);
        break;
      case 'remove':
        await handleRemoveCommand(message, args);
        break;
      case 'list':
        await handleListCommand(message);
        break;
      case 'help':
        await handleHelpCommand(message);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`Error handling command ${command}:`, error);
    const embed = createErrorEmbed('An error occurred while processing your command. Please try again.');
    await message.reply({ embeds: [convertToDiscordEmbed(embed)] });
  }
}

let client: Client | null = null;
let botStarted = false;

export async function startBot(): Promise<void> {
  if (botStarted) {
    console.log('Bot already started');
    return;
  }
  
  console.log('Starting Discord bot...');
  
  startPriceMonitor();
  
  const botToken = process.env.DISCORD_BOT_TOKEN;
  
  if (!botToken) {
    console.log('DISCORD_BOT_TOKEN not set. Bot commands will not work.');
    console.log('Price monitoring and webhook alerts are still active.');
    console.log('Use the web interface to manage tracked items.');
    botStarted = true;
    return;
  }
  
  try {
    client = await getDiscordClient();
    
    client.on('ready', () => {
      console.log(`Bot logged in as ${client?.user?.tag}`);
    });
    
    client.on('messageCreate', handleMessage);
    
    client.on('error', (error) => {
      console.error('Discord client error:', error);
    });
    
    console.log('Discord bot started successfully');
  } catch (error) {
    console.error('Failed to start Discord bot:', error);
    console.log('Bot commands will not work, but price monitoring continues.');
  }
  
  botStarted = true;
}

export function getClient(): Client | null {
  return client;
}
