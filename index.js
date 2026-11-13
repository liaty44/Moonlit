const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
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
const afkUsers = new Map();      // Stores userId -> { reason, time }
const cooldowns = new Map();   // 3s Command Cooldown Map
const snipedMessages = new Map(); // Stores deleted messages for .snipe

// 🛡️ Strict Bad Words List (Only core abuses and gaaliyan)
const badWords = [
  'madarchod', 'behenchod', 'bhosdike', 'chutiya', 'randi', 'gandu', 
  'lauda', 'lund', 'choot', 'mc', 'bc'
];

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// 🎯 Snipe event listener to track deleted messages
client.on('messageDelete', message => {
  if (message.author?.bot) return;
  snipedMessages.set(message.channel.id, {
    content: message.content,
    author: message.author.tag,
    image: message.attachments.first()?.proxyURL || null,
    time: Date.now()
  });
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  // 1️⃣ AFK Instant Return Check (Jaise hi user message karega, AFK hat jayega)
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    const returnEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setDescription(`👋 Welcome back **${message.author.username}**, your AFK status has been removed! ✨`);
    const returnMsg = await message.channel.send({ embeds: [returnEmbed] });
    setTimeout(() => returnMsg.delete().catch(() => {}), 5000);
  }

  // 2️⃣ Check AFK Mentions (DM to AFK user & 1 min auto-delete bot reply)
  message.mentions.users.forEach(async user => {
    if (afkUsers.has(user.id)) {
      const afkData = afkUsers.get(user.id);
      const timeAgo = Math.floor((Date.now() - afkData.time) / 60000); // minutes
      
      // Send DM to AFK user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('🔔 You were mentioned while AFK!')
          .setDescription(`**${message.author.tag}** mentioned you in **${message.guild.name}**.\n\n**Message:** "${message.content}"`);
        await user.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.log('Could not send DM to AFK user.');
      }

      // Send chat reply and auto-delete after 1 minute (60,000 ms)
      const afkEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💤 User is currently AFK')
        .setDescription(`💤 **${user.username}** is away.`)
        .addFields(
          { name: 'Reason', value: afkData.reason || 'No reason provided', inline: true },
          { name: 'Away For', value: `${timeAgo} minutes`, inline: true }
        );
      
      const replyMsg = await message.reply({ embeds: [afkEmbed] }).catch(() => {});
      if (replyMsg) {
        setTimeout(() => replyMsg.delete().catch(() => {}), 60000);
      }
    }
  });

  // 3️⃣ Precise Auto-Moderation (Ignores emojis/normal chat, catches only abuses)
  if (message.guild) {
    const wordsInMessage = message.content.toLowerCase().split(/\s+/);
    const isAbusive = wordsInMessage.some(word => badWords.includes(word));

    if (isAbusive) {
      try {
        await message.delete();

        // ⚠️ Channel Warning Embed
        const warnEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('⚠️ Auto-Mod Warning')
          .setDescription(`${message.author}, your message was deleted because it contained prohibited abusive words.`);
        await message.channel.send({ embeds: [warnEmbed] });

        // 📩 DM Notification to User
        try {
          const dmEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚨 Moderation Action Notice')
            .setDescription(`You have been timed out for **10 minutes** in **${message.guild.name}**.\n\n**Reason:** Using prohibited abusive words.`);
          await message.author.send({ embeds: [dmEmbed] });
        } catch (dmErr) {}

        // ⏱️ Apply 10-Minute Timeout
        if (message.member && message.member.moderatable) {
          await message.member.timeout(10 * 60 * 1000, 'Prohibited abusive words violation');
        }
        return;
      } catch (err) {
        console.log('Auto-mod error:', err);
      }
    }
  }

  // 4️⃣ Command Handler & 3s Cooldown System
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ⏳ 3 Seconds Cooldown Check
  if (!cooldowns.has(command)) {
    cooldowns.set(command, new Map());
  }
  const now = Date.now();
  const timestamps = cooldowns.get(command);
  const cooldownAmount = 3000; // 3 seconds

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
    if (now < expirationTime) {
      const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
      return message.reply(`⏳ Please wait **${timeLeft}s** before using the \`${command}\` command again!`).catch(() => {});
    }
  }
  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  // 📄 .help Command
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('✨ Bot Help Menu 🌟')
      .setDescription('Here are all available commands:')
      .addFields(
        { name: '🛠️ `.help`', value: 'Displays this command panel', inline: true },
        { name: '💤 `.afk [reason]`', value: 'Sets your custom AFK status', inline: true },
        { name: '🖼️ `.av [@user]`', value: 'Shows user avatar in high quality', inline: true },
        { name: '🔊 `.vc`', value: 'Connects bot to VC (Admin Only)', inline: true },
        { name: '⏱️ `.t [@user] [min] [reason]`', value: 'Timeout user (Admin Only)', inline: true },
        { name: '🌟 `.premium`', value: 'Displays bot premium features', inline: true },
        { name: '📊 `.poll [question]`', value: 'Creates an interactive server poll', inline: true },
        { name: '🎯 `.snipe`', value: 'Recovers the last deleted message', inline: true },
        { name: '🏰 `.serverinfo`', value: 'Shows detailed server info', inline: true }
      );
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

  // 🔊 .vc Command (Admin Only)
  if (command === 'vc') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ You need **Administrator** permissions to use `.vc`!').catch(() => {});
    }

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
      return message.reply('❌ Failed to join the voice channel.').catch(() => {});
    }
  }

  // ⏱️ .t Command (Admin Only Timeout + DM)
  if (command === 't') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('❌ You need **Administrator** permissions to use `.t`!').catch(() => {});
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('❌ Please mention a user to timeout! Usage: `.t @user [minutes] [reason]`').catch(() => {});
    }

    const durationMinutes = parseInt(args[1]) || 10;
    const durationMs = durationMinutes * 60 * 1000;
    const reason = args.slice(2).join(' ') || 'No reason provided';

    try {
      await target.timeout(durationMs, reason);

      // DM to user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle(`🚨 Moderation Notice - ${message.guild.name}`)
          .setDescription(`You have been timed out for **${durationMinutes} minutes**.\n\n**Reason:** ${reason}`);
        await target.send({ embeds: [dmEmbed] });
      } catch (e) {}

      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setDescription(`✅ Successfully timed out **${target.user.tag}** for ${durationMinutes} minutes.\n**Reason:** ${reason}`);
      return message.reply({ embeds: [successEmbed] });
    } catch (err) {
      return message.reply('❌ Failed to timeout user. Make sure my role is higher than theirs!').catch(() => {});
    }
  }

  // 🌟 .premium Command
  if (command === 'premium') {
    const premEmbed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🌟 Bot Premium Features ✨')
      .setDescription('Unlock the ultimate server experience with our exclusive perks!')
      .addFields(
        { name: '🚀 24/7 Ultra Speed', value: 'High performance priority cloud hosting.', inline: false },
        { name: '🛡️ Advanced Auto-Mod', value: 'Smart keyword filtering & lightning-fast moderation.', inline: false },
        { name: '💎 Nitro Emojis Integration', value: 'Full support for custom & animated emojis across all embeds.', inline: false }
      )
      .setFooter({ text: 'Contact bot owner to upgrade to Premium!' });
    return message.reply({ embeds: [premEmbed] }).catch(() => {});
  }

  // 📊 New Feature 1: .poll [question]
  if (command === 'poll') {
    const question = args.join(' ');
    if (!question) {
      return message.reply('❌ Please provide a question for the poll! Usage: `.poll [your question]`').catch(() => {});
    }
    const pollEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📊 Server Poll')
      .setDescription(question)
      .setFooter({ text: `Poll created by ${message.author.tag}` })
      .setTimestamp();
    
    const pollMsg = await message.channel.send({ embeds: [pollEmbed] }).catch(() => {});
    if (pollMsg) {
      await pollMsg.react('👍');
      await pollMsg.react('👎');
    }
    return;
  }

  // 🎯 New Feature 2: .snipe
  if (command === 'snipe') {
    const sniped = snipedMessages.get(message.channel.id);
    if (!sniped) {
      return message.reply('❌ There are no recently deleted messages to snipe in this channel!').catch(() => {});
    }
    const snipeEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎯 Sniped Message')
      .setDescription(`**Author:** ${sniped.author}\n**Message:** ${sniped.content || '*(No text, attachment/image only)*'}`)
      .setTimestamp(sniped.time);
    
    if (sniped.image) {
      snipeEmbed.setImage(sniped.image);
    }
    return message.reply({ embeds: [snipeEmbed] }).catch(() => {});
  }

  // 🏰 New Feature 3: .serverinfo
  if (command === 'serverinfo') {
    const { guild } = message;
    const serverEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🏰 Server Information: ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👑 Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 Total Members', value: `${guild.memberCount}`, inline: true },
        { name: '📅 Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '💬 Channels', value: `${guild.channels.cache.size}`, inline: true }
      )
      .setTimestamp();
    return message.reply({ embeds: [serverEmbed] }).catch(() => {});
  }
});

client.login(process.env.TOKEN);
