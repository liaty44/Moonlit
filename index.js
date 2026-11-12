const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const express = require('express');
const OpenAI = require('openai');

// 🌐 Express server for Render web service port binding
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is active and running 24/7! 🚀');
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

// 🤖 OpenAI Setup for Smart AI Moderation
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🤖 Discord Bot Setup with required gateway intents
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
const afkUsers = new Map(); // Stores userId -> { reason, time }
const userWarnings = new Map(); // Stores userId -> warning count for auto-mod

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // 1️⃣ AFK Return Check
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    const returnEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setDescription(`👋 **${message.author.username}** is no longer AFK!`);
    message.channel.send({ embeds: [returnEmbed] }).catch(() => {});
  }

  // 2️⃣ Check AFK Mentions
  message.mentions.users.forEach(user => {
    if (afkUsers.has(user.id)) {
      const afkData = afkUsers.get(user.id);
      const timeAgo = Math.floor((Date.now() - afkData.time) / 60000); // minutes
      const tickEmoji = '<:tick:995734>'; // Custom Discord emoji format
      
      const afkEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💤 User is currently AFK')
        .setDescription(`${tickEmoji} **${user.username}** is away.`)
        .addFields(
          { name: 'Reason', value: afkData.reason || 'No reason provided', inline: true },
          { name: 'Away For', value: `${timeAgo} minutes`, inline: true }
        );
      message.reply({ embeds: [afkEmbed] }).catch(() => {});
    }
  });

  // 3️⃣ AI Smart Auto-Moderation (OpenAI Moderation API)
  if (message.guild) {
    try {
      const moderation = await openai.moderations.create({
        input: message.content,
      });

      const results = moderation.results[0];

      if (results.flagged) {
        await message.delete();

        // Track user offenses
        let warnings = userWarnings.get(message.author.id) || 0;
        warnings += 1;
        userWarnings.set(message.author.id, warnings);

        if (warnings === 1) {
          // 1st Offense: Warning
          const warnEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⚠️ Auto-Mod Warning (1/2)')
            .setDescription(`${message.author}, your message was flagged for inappropriate content. Next time you will be timed out.`);
          
          await message.channel.send({ embeds: [warnEmbed] });
        } else if (warnings >= 2) {
          // 2nd Offense & above: Timeout
          const timeoutEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('⏱️ Auto-Mod Timeout (2/2)')
            .setDescription(`${message.author}, you have been timed out for 10 minutes due to repeated inappropriate messages.`);
          
          await message.channel.send({ embeds: [timeoutEmbed] });

          if (message.member && message.member.moderatable) {
            await message.member.timeout(10 * 60 * 1000, 'Repeated inappropriate content / Abuse');
          }
        }
        return;
      }
    } catch (err) {
      console.error('OpenAI moderation error:', err);
    }
  }

  // 4️⃣ Command Handler
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 📄 .help Command
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('✨ Premium Bot Help Menu')
      .setDescription('Here are your available commands:')
      .addFields(
        { name: '🛠️ `.help`', value: 'Displays this command panel', inline: true },
        { name: '💤 `.afk [reason]`', value: 'Sets your custom AFK status', inline: true },
        { name: '🖼️ `.av [@user]`', value: 'Shows user avatar in high quality', inline: true },
        { name: '🔊 `.vc`', value: 'Connects bot to your voice channel for 24/7 presence', inline: true }
      );
    
    return message.reply({ embeds: [embed] }).catch(() => {});
  }

  // 💤 .afk Command
  if (command === 'afk') {
    const reason = args.join(' ') || 'AFK';
    afkUsers.set(message.author.id, { reason, time: Date.now() });

    const tickEmoji = '<:tick:995734>'; // Custom Discord emoji format
    const afkSetEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(`💤 ${tickEmoji} **${message.author.username}**, I have set your AFK: **${reason}**`);
    
    return message.reply({ embeds: [afkSetEmbed] }).catch(() => {});
  }

  // 🖼️ .av Command
  if (command === 'av') {
    const target = message.mentions.users.first() || message.author;
    const avEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🖼️ ${target.username}'s Avatar`)
      .setImage(target.displayAvatarURL({ size: 1024, dynamic: true }));

    return message.reply({ embeds: [avEmbed] }).catch(() => {});
  }

  // 🔊 .vc Command (24/7 Voice Channel Connection)
  if (command === 'vc') {
    const channel = message.member?.voice.channel;

    if (!channel) {
      return message.reply('❌ You need to be in a voice channel first to use `.vc`!').catch(() => {});
    }

    try {
      joinVoiceChannel({
        channelId: channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false
      });

      const vcEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setDescription(`🔊 Successfully joined **${channel.name}** and staying connected 24/7!`);
      
      return message.reply({ embeds: [vcEmbed] }).catch(() => {});
    } catch (err) {
      console.error('VC connection error:', err);
      return message.reply('❌ Failed to join the voice channel. Make sure I have permission to connect!').catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
