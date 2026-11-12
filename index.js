const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');

// 🌐 Express server to satisfy Render's web service port requirement
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is active and running 24/7! 🚀');
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

// 🤖 Discord Bot Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

const PREFIX = '.';

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 📄 .help Command
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('✨ Premium Bot Help Menu')
      .setDescription('Here are the available prefix commands:')
      .addFields(
        { name: '🛠️ `.help`', value: 'Displays this command panel', inline: true },
        { name: '💤 `.afk [reason]`', value: 'Sets your custom AFK status', inline: true },
        { name: '🖼️ `.av [@user]`', value: 'Shows user avatar in high quality', inline: true },
        { name: '🔊 `.vc`', value: 'Connects bot to your voice channel 24/7', inline: true }
      )
      .setFooter({ text: 'Designed for high performance' });
    
    return message.reply({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
