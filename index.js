const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const express = require('express');

// 🌐 Express server for Render web service port binding
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is active and running 24/7! 🚀');
});

app.listen(PORT, () => {
  console.log(`Web server listening on port ${PORT}`);
});

// 🤖 Discord Bot Setup with required intents
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
const badWords = ['fuc', 'f@uc', 'abuse1', 'abuse2']; // Add words you want to filter

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
      const afkEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💤 User is currently AFK')
        .setDescription(`**${user.username}** is away.`)
        .addFields(
          { name: 'Reason', value: afkData.reason || 'No reason provided', inline: true },
          { name: 'Away For', value: `${timeAgo} minutes`, inline: true }
        );
      message.reply({ embeds: [afkEmbed] }).catch(() => {});
    }
  });

  // 3️⃣ Auto-Moderation (Bad Words / Abuse)
  const lowerContent = message.content.toLowerCase();
  const containsBadWord = badWords.some(word => lowerContent.includes(word));

  if (containsBadWord && message.guild) {
    try {
      await message.delete();
      
      // Warn in channel
      const warnEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('⚠️ Auto-Mod Warning')
        .setDescription(`${message.author}, your message was deleted for violating chat rules.`);
      
      const sentMsg = await message.channel.send({ embeds: [warnEmbed] });
      
      // Try to timeout if member persists or on first strike depending on config
      // Here we apply timeout directly as requested if harassment is detected
      if (message.member && message.member.moderatable) {
        await message.member.timeout(10 * 60 * 1000, 'Harassment / Prohibited words');
        
        // Notify via DM
        try {
          await message.author.send(`⚠️ You have been timed out for 10 minutes in **${message.guild.name}** for using prohibited words.`);
        } catch (dmErr) {
          console.log('Could not send DM to user.');
        }
      }
      return;
    } catch (err) {
      console.log('Auto-mod error:', err);
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
        { name: '🖼️ `.av [@user]`', value: 'Shows user avatar in high quality', inline: true }
      )
      .setFooter({ text: 'Powered by 24/7 Render Hosting' });
    
    return message.reply({ embeds: [embed] }).catch(() => {});
  }

  // 💤 .afk Command
  if (command === 'afk') {
    const reason = args.join(' ') || 'AFK';
    afkUsers.set(message.author.id, { reason, time: Date.now() });

    const afkSetEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(`💤 **${message.author.username}**, I have set your AFK: **${reason}**`);
    
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
});

client.login(process.env.TOKEN);
