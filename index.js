const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
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

  // 1️⃣ AFK Instant Return Check
  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    const returnEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setDescription(`<:codexenjoy:1570762957946757130> **W𝐄𝐋𝐂𝐎𝐌𝐄 𝐁𝐀𝐂𝐊, ${message.author.username.toUpperCase()}!**\n\n✨ *Your AFK status has been successfully removed.*`);
    const returnMsg = await message.channel.send({ embeds: [returnEmbed] });
    setTimeout(() => returnMsg.delete().catch(() => {}), 5000);
  }

  // 2️⃣ Check AFK Mentions (Stylish DM to AFK user & 1 min auto-delete bot reply)
  message.mentions.users.forEach(async user => {
    if (afkUsers.has(user.id)) {
      const afkData = afkUsers.get(user.id);
      const timeAgo = Math.floor((Date.now() - afkData.time) / 60000); // minutes
      
      // Stylish DM to AFK user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FFA500')
          .setTitle('🔔 **𝐀𝐅𝐊 𝐌𝐄𝐍𝐓𝐈𝐎𝐍 𝐀𝐋𝐄𝐑𝐓**')
          .setDescription(`> 👑 **Server:** \`${message.guild.name}\`\n> 👤 **User:** \`${message.author.tag}\`\n\n💬 **Message Content:**\n\`\`\`${message.content}\`\`\``)
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch (err) {
        console.log('Could not send DM to AFK user.');
      }

      // Stylish chat reply and auto-delete after 1 minute (60,000 ms)
      const afkEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('<:codexenjoy:1570762957946757130> **𝐔𝐒𝐄𝐑 𝐈𝐒 𝐂𝐔𝐑𝐑𝐄𝐍𝐓𝐋𝐘 𝐀𝐅𝐊**')
        .setDescription(`> 💤 **${user.username}** is away from keyboard right now.`)
        .addFields(
          { name: '📌 **𝐑𝐄𝐀𝐒𝐎𝐍**', value: `\`${afkData.reason || 'No reason provided'}\``, inline: true },
          { name: '⏳ **𝐀𝐖𝐀𝐘 𝐅𝐎𝐑**', value: `\`${timeAgo} minutes\``, inline: true }
        )
        .setTimestamp();
      
      const replyMsg = await message.reply({ embeds: [afkEmbed] }).catch(() => {});
      if (replyMsg) {
        setTimeout(() => replyMsg.delete().catch(() => {}), 60000);
      }
    }
  });

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
      return message.reply(`<a:warning:1570699409123971126> **𝐏𝐋𝐄𝐀𝐒𝐄 𝐖𝐀𝐈𝐓!**\n> ⏳ Cooldown active: \`${timeLeft}s\` remaining for \`${command}\`.`).catch(() => {});
    }
  }
  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  // 🌟 .helps Command with Interactive Stylish Dropdown Menu
  if (command === 'helps') {
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('command_menu')
        .setPlaceholder('📂 EXPLORE COMMAND DASHBOARD')
        .addOptions([
          {
            label: 'AFK System',
            description: 'Set your AFK status with reason & DM alerts',
            value: 'cmd_afk',
            emoji: '1570762957946757130'
          },
          {
            label: 'User Avatar (.av)',
            description: 'View high-resolution user avatars',
            value: 'cmd_av',
            emoji: '1570762961642070096'
          },
          {
            label: 'Voice Channel (.vc)',
            description: 'Connect bot to VC (Admin Only)',
            value: 'cmd_vc',
            emoji: '1570762968218599504'
          },
          {
            label: 'Timeout User (.t)',
            description: 'Timeout a member with DM notification (Admin Only)',
            value: 'cmd_timeout',
            emoji: '1570762972291141694'
          },
          {
            label: 'Server Poll (.poll)',
            description: 'Create an interactive server poll',
            value: 'cmd_poll',
            emoji: '1570762983422828574'
          },
          {
            label: 'Snipe Deleted Message (.snipe)',
            description: 'Recover the last deleted message',
            value: 'cmd_snipe',
            emoji: '1570699409123971126'
          },
          {
            label: 'Server Info (.serverinfo)',
            description: 'Display detailed server statistics',
            value: 'cmd_serverinfo',
            emoji: '1570762989240582209'
          }
        ])
    );

    const menuEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('<a:warning:1570699409123971126> **𝐈𝐍𝐓𝐄𝐑𝐀𝐂𝐓𝐈𝐕𝐄 𝐂𝐎𝐌𝐌𝐀𝐍𝐃 𝐃𝐀𝐒𝐇𝐁𝐎𝐀𝐑𝐃** ✨')
      .setDescription('> *Welcome to the ultimate command control center! Use the stylish dropdown menu below to explore all features powered with your custom server emojis.* 💎');

    const sentMsg = await message.reply({ embeds: [menuEmbed], components: [row] });

    const collector = sentMsg.createMessageComponentCollector({ time: 45000 });

    collector.on('collect', async i => {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: '❌ **This interactive menu is not for you!**', ephemeral: true });
      }

      const val = i.values[0];
      let responseText = '';

      if (val === 'cmd_afk') {
        responseText = '<:codexenjoy:1570762957946757130> **.afk [reason]** — Sets your AFK status. When anyone mentions or replies to you, the bot automatically DMs them your message and notifies you!';
      } else if (val === 'cmd_av') {
        responseText = '<a:spider_whatsup:1570762961642070096> **.av [@user]** — Fetches and displays the high-resolution avatar of yourself or the mentioned user.';
      } else if (val === 'cmd_vc') {
        responseText = '<:codex_vc:1570762968218599504> **.vc** — Connects the bot to your current voice channel for 24/7 presence (**Administrator Only**).';
      } else if (val === 'cmd_timeout') {
        responseText = '<:codex_warn:1570762972291141694> **.t [@user] [minutes] [reason]** — Times out a member and sends them an automated DM notification (**Administrator Only**).';
      } else if (val === 'cmd_poll') {
        responseText = '<:wnb_bacha:1570762983422828574> **.poll [question]** — Creates an interactive voting poll with thumbs-up and thumbs-down reactions.';
      } else if (val === 'cmd_snipe') {
        responseText = '<a:warning:1570699409123971126> **.snipe** — Recovers and displays the most recently deleted text or image attachment in the current channel.';
      } else if (val === 'cmd_serverinfo') {
        responseText = '<:server:1570762989240582209> **.serverinfo** — Displays comprehensive details about the server, including owner, member count, and creation date.';
      }

      await i.reply({ content: responseText, ephemeral: true });
    });

    collector.on('end', () => {
      sentMsg.edit({ components: [] }).catch(() => {});
    });
    return;
  }

  // 💤 .afk Command
  if (command === 'afk') {
    const reason = args.join(' ') || 'AFK';
    afkUsers.set(message.author.id, { reason, time: Date.now() });

    const afkSetEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(`<:codexenjoy:1570762957946757130> **𝐒𝐓𝐀𝐓𝐔𝐒 𝐔𝐏𝐃𝐀𝐓𝐄𝐃**\n\n> 💤 **${message.author.username}**, I have successfully set your AFK:\n> \`${reason}\``);
    return message.reply({ embeds: [afkSetEmbed] }).catch(() => {});
  }

  // 🖼️ .av Command
  if (command === 'av') {
    const target = message.mentions.users.first() || message.author;
    const avEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`<a:spider_whatsup:1570762961642070096> **${target.username.toUpperCase()}'𝐒 𝐀𝐕𝐀𝐓𝐀𝐑**`)
      .setImage(target.displayAvatarURL({ size: 1024, dynamic: true }));
    return message.reply({ embeds: [avEmbed] }).catch(() => {});
  }

  // 🔊 .vc Command (Admin Only)
  if (command === 'vc') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('<:codex_warn:1570762972291141694> **𝐀𝐂𝐂𝐄𝐒𝐒 𝐃𝐄𝐍𝐈𝐄𝐃!**\n> ❌ You need **Administrator** permissions to use `.vc`.').catch(() => {});
    }

    const channel = message.member?.voice.channel;
    if (!channel) {
      return message.reply('<:codex_vc:1570762968218599504> **𝐍𝐎𝐓 𝐈𝐍 𝐕𝐎𝐈𝐂𝐄!**\n> ❌ You need to be in a voice channel first to use `.vc`.').catch(() => {});
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
        .setDescription(`<:codex_vc:1570762968218599504> **𝐕𝐎𝐈𝐂𝐄 𝐂𝐎𝐍𝐍𝐄𝐂𝐓𝐄𝐃**\n\n> 🔊 Successfully joined **${channel.name}** and staying connected 24/7!`);
      return message.reply({ embeds: [vcEmbed] }).catch(() => {});
    } catch (err) {
      return message.reply('<a:warning:1570699409123971126> **𝐅𝐀𝐈𝐋𝐄𝐃 𝐓𝐎 𝐉𝐎𝐈𝐍!**\n> ❌ Make sure I have permission to connect.').catch(() => {});
    }
  }

  // ⏱️ .t Command (Admin Only Timeout + Stylish DM)
  if (command === 't') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply('<:codex_warn:1570762972291141694> **𝐀𝐂𝐂𝐄𝐒𝐒 𝐃𝐄𝐍𝐈𝐄𝐃!**\n> ❌ You need **Administrator** permissions to use `.t`.').catch(() => {});
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply('<:codex_warn:1570762972291141694> **𝐈𝐍𝐕𝐀𝐋𝐈𝐃 𝐔𝐒𝐀𝐆𝐄!**\n> 📌 Usage: `.t @user [minutes] [reason]`').catch(() => {});
    }

    const durationMinutes = parseInt(args[1]) || 10;
    const durationMs = durationMinutes * 60 * 1000;
    const reason = args.slice(2).join(' ') || 'No reason provided';

    try {
      await target.timeout(durationMs, reason);

      // Stylish DM to user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('<:codex_warn:1570762972291141694> **𝐌𝐎𝐃𝐄𝐑𝐀𝐓𝐈𝐎𝐍 𝐀𝐂𝐓𝐈𝐎𝐍 𝐍𝐎𝐓𝐈𝐂𝐄**')
          .setDescription(`> 🏰 **Server:** \`${message.guild.name}\`\n> ⏱️ **Duration:** \`${durationMinutes} minutes\`\n\n📝 **Reason:**\n\`\`\`${reason}\`\`\``)
          .setTimestamp();
        await target.send({ embeds: [dmEmbed] });
      } catch (e) {}

      const successEmbed = new EmbedBuilder()
        .setColor('#00FF00')
        .setDescription(`<:codex_warn:1570762972291141694> **𝐓𝐈𝐌𝐄𝐎𝐔𝐓 𝐒𝐔𝐂𝐂𝐄𝐒𝐒𝐅𝐔𝐋**\n\n> ✅ Successfully timed out **${target.user.tag}** for **${durationMinutes} minutes**.\n> 📌 **Reason:** \`${reason}\``);
      return message.reply({ embeds: [successEmbed] });
    } catch (err) {
      return message.reply('<a:warning:1570699409123971126> **𝐅𝐀𝐈𝐋𝐄𝐃!**\n> ❌ Make sure my role is higher than the target user.').catch(() => {});
    }
  }

  // 📊 .poll Command
  if (command === 'poll') {
    const question = args.join(' ');
    if (!question) {
      return message.reply('<:wnb_bacha:1570762983422828574> **𝐈𝐍𝐕𝐀𝐋𝐈𝐃 𝐔𝐒𝐀𝐆𝐄!**\n> 📌 Usage: `.poll [your question]`').catch(() => {});
    }
    const pollEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('<:wnb_bacha:1570762983422828574> **𝐒𝐄𝐑𝐕𝐄𝐑 𝐏𝐎𝐋𝐋**')
      .setDescription(`> 📢 ${question}`)
      .setFooter({ text: `Poll created by ${message.author.tag}` })
      .setTimestamp();
    
    const pollMsg = await message.channel.send({ embeds: [pollEmbed] }).catch(() => {});
    if (pollMsg) {
      await pollMsg.react('👍');
      await pollMsg.react('👎');
    }
    return;
  }

  // 🎯 .snipe Command
  if (command === 'snipe') {
    const sniped = snipedMessages.get(message.channel.id);
    if (!sniped) {
      return message.reply('<a:warning:1570699409123971126> **𝐍𝐎 𝐌𝐄𝐒𝐒𝐀𝐆𝐄𝐒 𝐅𝐎𝐔𝐍𝐃!**\n> ❌ There are no recently deleted messages to snipe in this channel.').catch(() => {});
    }
    const snipeEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('<a:warning:1570699409123971126> **𝐒𝐍𝐈𝐏𝐄𝐃 𝐌𝐄𝐒𝐒𝐀𝐆𝐄**')
      .setDescription(`> 👤 **Author:** \`${sniped.author}\`\n\n💬 **Content:**\n\`\`\`${sniped.content || '(No text, attachment/image only)'}\`\`\``)
      .setTimestamp(sniped.time);
    
    if (sniped.image) {
      snipeEmbed.setImage(sniped.image);
    }
    return message.reply({ embeds: [snipeEmbed] }).catch(() => {});
  }

  // 🏰 .serverinfo Command
  if (command === 'serverinfo') {
    const { guild } = message;
    const serverEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`<:server:1570762989240582209> **𝐒𝐄𝐑𝐕𝐄𝐑 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐓𝐈𝐎𝐍: ${guild.name.toUpperCase()}**`)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👑 **𝐎𝐖𝐍𝐄𝐑**', value: `<@${guild.ownerId}>`, inline: true },
        { name: '👥 **𝐌𝐄𝐌𝐁𝐄𝐑𝐒**', value: `\`${guild.memberCount}\``, inline: true },
        { name: '📅 **𝐂𝐑𝐄𝐀𝐓𝐄𝐃**', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '💬 **𝐂𝐇𝐀𝐍𝐍𝐄𝐋𝐒**', value: `\`${guild.channels.cache.size}\``, inline: true }
      )
      .setTimestamp();
    return message.reply({ embeds: [serverEmbed] }).catch(() => {});
  }
});

client.login(process.env.TOKEN);
