import { Client, GatewayIntentBits, Message, EmbedBuilder } from 'discord.js';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=discord',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Discord not connected');
  }
  return accessToken;
}

export async function getDiscordClient(): Promise<Client> {
  const token = await getAccessToken();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ]
  });

  await client.login(token);
  return client;
}

export function convertToDiscordEmbed(embed: any): EmbedBuilder {
  const builder = new EmbedBuilder();
  
  if (embed.title) builder.setTitle(embed.title);
  if (embed.description) builder.setDescription(embed.description);
  if (embed.color !== undefined) builder.setColor(embed.color);
  if (embed.thumbnail?.url) builder.setThumbnail(embed.thumbnail.url);
  if (embed.footer?.text) builder.setFooter({ text: embed.footer.text });
  if (embed.timestamp) builder.setTimestamp(new Date(embed.timestamp));
  if (embed.fields && embed.fields.length > 0) {
    builder.addFields(embed.fields.map((f: any) => ({
      name: f.name,
      value: f.value,
      inline: f.inline ?? false,
    })));
  }
  
  return builder;
}
