const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  ChannelType, 
  MessageFlags, 
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Configure event and auto-moderation logging dashboard (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const { guild } = interaction;

    if (!guild) {
      return interaction.reply({
        content: '❌ This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Helper to generate dashboard embed
    function getDashboardEmbed() {
      const settings = db.getGuild(guild.id);
      const logChannelId = settings.logChannelId;
      const channelsEnabled = settings.logging?.channelsEnabled !== false;

      const channelDisplay = logChannelId ? `<#${logChannelId}>` : '🔴 **Disabled**';
      const toggDisplay = channelsEnabled ? '✅ **Enabled**' : '❌ **Disabled**';

      return new EmbedBuilder()
        .setTitle('📝 Server Logging Dashboard')
        .setDescription('Manage where event logs and AutoMod alerts are sent, and toggle specific logging features.')
        .setColor(0x9B59B6)
        .addFields(
          { name: 'Log Target Channel', value: channelDisplay, inline: true },
          { name: 'Channel & Category Changes', value: toggDisplay, inline: true }
        )
        .setFooter({ text: 'Use the drop-down menu below to edit configurations.' })
        .setTimestamp();
    }

    // Helper to generate dashboard controls
    function getDashboardRows() {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('log-dashboard-action')
        .setPlaceholder('Select an option to configure')
        .addOptions([
          { label: 'Set Log Channel', value: 'action_set_channel', emoji: '🎯', description: 'Assign a channel to send event logs' },
          { label: 'Toggle Channel Logs', value: 'action_toggle_channels', emoji: '📁', description: 'Enable/disable logs for channel updates' },
          { label: 'Disable Logging', value: 'action_disable', emoji: '📴', description: 'Turn off all logging and alert events' }
        ]);

      const closeBtn = new ButtonBuilder()
        .setCustomId('log-dashboard-close')
        .setLabel('Close Menu')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌');

      return [
        new ActionRowBuilder().addComponents(selectMenu),
        new ActionRowBuilder().addComponents(closeBtn)
      ];
    }

    // Send initial response
    const response = await interaction.reply({
      embeds: [getDashboardEmbed()],
      components: getDashboardRows(),
      flags: MessageFlags.Ephemeral,
      fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time: 240000 // 4 minutes active
    });

    collector.on('collect', async i => {
      try {
        if (!i.isDeferred && !i.isReplied) {
          await i.deferUpdate();
        }

        // Close menu
        if (i.customId === 'log-dashboard-close') {
          collector.stop();
          return;
        }

        // Dropdown actions
        if (i.customId === 'log-dashboard-action') {
          const action = i.values[0];

          if (action === 'action_toggle_channels') {
            const settings = db.getGuild(guild.id);
            if (!settings.logging) settings.logging = { channelsEnabled: true };
            settings.logging.channelsEnabled = !settings.logging.channelsEnabled;
            db.setGuild(guild.id, settings);

            await interaction.editReply({
              embeds: [getDashboardEmbed()],
              components: getDashboardRows()
            });
          }

          else if (action === 'action_disable') {
            const settings = db.getGuild(guild.id);
            settings.logChannelId = null;
            db.setGuild(guild.id, settings);

            await interaction.editReply({
              embeds: [getDashboardEmbed()],
              components: getDashboardRows()
            });
          }

          else if (action === 'action_set_channel') {
            // Display native channel select menu
            const channelSelect = new ChannelSelectMenuBuilder()
              .setCustomId('log-channel-picker')
              .setPlaceholder('Select a text channel')
              .addChannelTypes(ChannelType.GuildText);

            const backBtn = new ButtonBuilder()
              .setCustomId('log-channel-picker-back')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              content: '🎯 **Select the text channel where the bot should send event logs:**',
              embeds: [],
              components: [
                new ActionRowBuilder().addComponents(channelSelect),
                new ActionRowBuilder().addComponents(backBtn)
              ]
            });
          }
        }

        // Channel Select Picker response
        if (i.customId === 'log-channel-picker') {
          const channelId = i.values[0];
          const channel = guild.channels.cache.get(channelId);

          if (!channel) {
            await interaction.editReply({
              content: '❌ Invalid channel selected. Please try again.',
              components: getDashboardRows(),
              embeds: [getDashboardEmbed()]
            });
            return;
          }

          // Verify bot permissions in channel
          const botMember = guild.members.me;
          if (botMember) {
            const channelPerms = channel.permissionsFor(botMember);
            if (!channelPerms || !channelPerms.has([
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.EmbedLinks
            ])) {
              await interaction.editReply({
                content: `❌ **Failed to assign channel:** I do not have permission to view, send messages, or embed links in ${channel}. Please adjust my channel overrides and try again.`,
                components: getDashboardRows(),
                embeds: [getDashboardEmbed()]
              });
              return;
            }
          }

          // Save settings
          const settings = db.getGuild(guild.id);
          settings.logChannelId = channel.id;
          db.setGuild(guild.id, settings);

          await interaction.editReply({
            content: `✅ Successfully set log channel to ${channel}!`,
            embeds: [getDashboardEmbed()],
            components: getDashboardRows()
          });
        }

        // Back from picker
        if (i.customId === 'log-channel-picker-back') {
          await interaction.editReply({
            content: null,
            embeds: [getDashboardEmbed()],
            components: getDashboardRows()
          });
        }

      } catch (err) {
        console.error('Logging Dashboard interaction error:', err);
      }
    });

    collector.on('end', () => {
      // Remove components when idle
      interaction.editReply({
        components: [],
        content: null
      }).catch(() => {});
    });
  }
};
