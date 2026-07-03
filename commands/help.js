const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const HELP_CATEGORIES = {
  channels: {
    title: '📁 Channel Management',
    color: 0x3498DB,
    description: 'Create and destroy channels or server structures in bulk.',
    commands: [
      {
        name: '/channel setup',
        desc: 'Builds a professional gaming server layout with voice channels, categories, read-only announcements, and roles (Admin, Moderator, Member, Bot). Prompts you to pick a font style and preview before creating.',
        example: '`/channel setup`'
      },
      {
        name: '/channel delete <target>',
        desc: 'Deletes a specific channel or category. If deleting a category, asks if you want to keep or delete the channels inside it.',
        example: '`/channel delete target: #general`'
      },
      {
        name: '/channel bulkdelete',
        desc: 'Opens an interactive selection list where you can check multiple channels/categories and delete them all at once, or wipe the entire server layout (all channels/categories). Includes severe confirmation checks.',
        example: '`/channel bulkdelete`'
      }
    ]
  },
  moderation: {
    title: '🛡️ Server Moderation (AutoMod)',
    color: 0xE74C3C,
    description: 'Keep your server clean and safe with automated moderation.',
    commands: [
      {
        name: '/automod filter add <regex> <action>',
        desc: 'Add a new regex keyword filter (e.g. badword|slur). Actions include: Delete, Warn (warns user), Timeout (10m timeout), and Log only.',
        example: '`/automod filter add regex: badword action: Delete & Warn`'
      },
      {
        name: '/automod filter remove <regex>',
        desc: 'Removes an active keyword regex filter. Autocomplete suggestion is enabled to show configured rules.',
        example: '`/automod filter remove regex: badword`'
      },
      {
        name: '/automod filter list',
        desc: 'Lists all active regex filters and their actions.',
        example: '`/automod filter list`'
      },
      {
        name: '/automod settings <enabled> [threshold]',
        desc: 'Toggle the Auto-Moderation engine. Optionally adjust the caps lock / repeated letters / mention spam heuristic sensitivity threshold (10-100%, lower is more sensitive, default is 75%).',
        example: '`/automod settings enabled: True threshold: 70`'
      }
    ]
  },
  logging: {
    title: '📝 Activity Logging',
    color: 0x9B59B6,
    description: 'Log major server events to track user and moderation activity.',
    commands: [
      {
        name: '/logging set <channel>',
        desc: 'Assigns a channel where the bot will send logs for message edits, message deletions (with attachment links), member joins, member leaves, ban/kick updates, timeouts, and channel/role creations.',
        example: '`/logging set channel: #mod-logs`'
      },
      {
        name: '/logging disable',
        desc: 'Disables all activity and audit logging on the server.',
        example: '`/logging disable`'
      }
    ]
  }
};

/**
 * Builds the home page embed for the help menu
 */
function buildHomeEmbed() {
  return new EmbedBuilder()
    .setTitle('📖 Server Guide & Command Directory')
    .setDescription([
      'Welcome to the help center! This bot offers premium automation, structured channel layouts, and server logging.',
      '',
      '👉 **Pick a category** from the drop-down select menu below to view detailed command lists, descriptions, and examples.'
    ].join('\n'))
    .setColor(0x5865F2)
    .addFields(
      { name: '📁 Channel Management', value: 'Server layouts, font styling, bulk deletions, wipes.', inline: true },
      { name: '🛡️ Server Moderation', value: 'Regex keyword blockers, heuristic spam/toxicity filter.', inline: true },
      { name: '📝 Activity Logging', value: 'Log edits, deletions, audit logs, and member changes.', inline: true }
    )
    .setTimestamp();
}

/**
 * Builds the selector components row
 */
function buildMenuComponents(showBackButton = false) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help-category-select')
    .setPlaceholder('Select a category to view commands')
    .addOptions([
      { label: 'Channel Management', emoji: '📁', value: 'channels' },
      { label: 'Server Moderation (AutoMod)', emoji: '🛡️', value: 'moderation' },
      { label: 'Activity Logging', emoji: '📝', value: 'logging' }
    ]);

  const rows = [new ActionRowBuilder().addComponents(selectMenu)];

  if (showBackButton) {
    const backBtn = new ButtonBuilder()
      .setCustomId('help-back-menu')
      .setLabel('Back to Main Guide')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏠');
    rows.push(new ActionRowBuilder().addComponents(backBtn));
  }

  return rows;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Open the interactive guides and commands directory'),

  async execute(interaction) {
    const response = await interaction.reply({
      embeds: [buildHomeEmbed()],
      components: buildMenuComponents(false),
      flags: MessageFlags.Ephemeral,
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 300000 // 5 minutes active
    });

    collector.on('collect', async i => {
      if (i.customId === 'help-category-select') {
        const categoryKey = i.values[0];
        const category = HELP_CATEGORIES[categoryKey];

        if (category) {
          await i.deferUpdate();

          const embed = new EmbedBuilder()
            .setTitle(category.title)
            .setDescription(`*${category.description}*\n\n` + category.commands.map(cmd => {
              return `🔹 **${cmd.name}**\n${cmd.desc}\n*Example:* ${cmd.example}`;
            }).join('\n\n'))
            .setColor(category.color)
            .setTimestamp();

          await interaction.editReply({
            embeds: [embed],
            components: buildMenuComponents(true)
          });
        }
      }

      else if (i.customId === 'help-back-menu') {
        await i.deferUpdate();
        await interaction.editReply({
          embeds: [buildHomeEmbed()],
          components: buildMenuComponents(false)
        });
      }
    });

    collector.on('end', () => {
      // Disable components after timeout
      interaction.editReply({
        components: []
      }).catch(() => {});
    });
  }
};
