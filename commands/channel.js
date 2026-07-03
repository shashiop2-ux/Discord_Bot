const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');

const { formatText, FONT_STYLES } = require('../utils/fonts');

// ── Server Layout definition for setup ──────────────────────────────────────────
const SERVER_LAYOUT = [
  {
    name: '📋 INFORMATION',
    channels: [
      { name: 'welcome',       type: ChannelType.GuildText, readOnly: true, topic: 'Say hello and feel at home!' },
      { name: 'rules',         type: ChannelType.GuildText, readOnly: true, topic: 'Read the server rules before chatting.' },
      { name: 'announcements', type: ChannelType.GuildText, readOnly: true, topic: 'Important updates from the staff team.' },
    ],
  },
  {
    name: '💬 COMMUNITY',
    channels: [
      { name: 'general-chat',       type: ChannelType.GuildText, topic: 'Hang out and talk about anything.' },
      { name: 'introductions',      type: ChannelType.GuildText, topic: 'Introduce yourself to the community!' },
      { name: 'memes',              type: ChannelType.GuildText, topic: 'Share your best memes here.' },
      { name: 'clips-and-highlights', type: ChannelType.GuildText, topic: 'Post your sickest clips and highlights.' },
    ],
  },
  {
    name: '🎮 GAMING',
    channels: [
      { name: 'looking-for-group', type: ChannelType.GuildText, topic: 'Find teammates for your next session.' },
      { name: 'game-news',         type: ChannelType.GuildText, topic: 'Latest news from the gaming world.' },
      { name: 'patch-notes',       type: ChannelType.GuildText, topic: 'Patch notes and update breakdowns.' },
    ],
  },
  {
    name: '🔊 VOICE CHANNELS',
    channels: [
      { name: 'General Hangout', type: ChannelType.GuildVoice },
      { name: 'Gaming Squad 1',  type: ChannelType.GuildVoice },
      { name: 'Gaming Squad 2',  type: ChannelType.GuildVoice },
      { name: 'Gaming Squad 3',  type: ChannelType.GuildVoice },
      { name: '🔇 AFK',          type: ChannelType.GuildVoice, isAFK: true },
    ],
  },
];

const ROLES = [
  { name: 'Admin', color: 0xE74C3C, permissions: [PermissionFlagsBits.Administrator] },
  { name: 'Moderator', color: 0x3498DB, permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.KickMembers, PermissionFlagsBits.MuteMembers] },
  { name: 'Member', color: 0x2ECC71, permissions: [] },
  { name: 'Bot', color: 0x95A5A6, permissions: [] },
];

function buildPreview(style) {
  const sampleCategory = '📋 INFORMATION';
  const sampleChannels = ['welcome', 'rules', 'general-chat'];
  const lines = [
    `**Category:** ${formatText(sampleCategory, style)}`,
    ...sampleChannels.map(ch => `  └ #${formatText(ch, style)}`),
  ];
  return lines.join('\n');
}

/**
 * Shared helper for bulk channel/category deletion.
 */
async function confirmAndExecuteDeletion(guild, selectedChannelIds, interaction) {
  const selectedCategories = [];
  const selectedOther = [];
  const allChildrenIds = new Set();

  for (const id of selectedChannelIds) {
    const ch = guild.channels.cache.get(id);
    if (!ch) continue;
    if (ch.type === ChannelType.GuildCategory) {
      selectedCategories.push(ch);
      const childChannels = guild.channels.cache.filter(child => child.parentId === ch.id);
      for (const child of childChannels.values()) {
        allChildrenIds.add(child.id);
      }
    } else {
      selectedOther.push(ch);
    }
  }

  const hasCategories = selectedCategories.length > 0;
  const selectedNames = [];

  for (const cat of selectedCategories) {
    selectedNames.push(`📁 ${cat.name} (Category)`);
  }
  for (const ch of selectedOther) {
    const isVoice = ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice;
    const isAnnounce = ch.type === ChannelType.GuildAnnouncement;
    selectedNames.push(`${isVoice ? '🔊' : isAnnounce ? '📢' : '#'}${ch.name}`);
  }

  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ Confirm Deletion')
    .setDescription(`Are you sure you want to delete the following **${selectedChannelIds.length}** item(s)? This action is permanent.`)
    .addFields({ name: 'Selected Items', value: selectedNames.join('\n').slice(0, 1024) })
    .setColor(0xE74C3C)
    .setTimestamp();

  const buttonComponents = [];

  if (hasCategories && allChildrenIds.size > 0) {
    buttonComponents.push(
      new ButtonBuilder().setCustomId('del-only').setLabel('Delete Selected Only').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('del-all').setLabel('Delete Selected & Category Channels').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('del-cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const childNames = [...allChildrenIds]
      .map(id => guild.channels.cache.get(id))
      .filter(Boolean)
      .map(ch => `${ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice ? '🔊' : '#'}${ch.name}`);

    if (childNames.length > 0) {
      confirmEmbed.addFields({ name: `ℹ️ Channels inside categories (${childNames.length})`, value: childNames.join('\n').slice(0, 1024) });
    }
  } else {
    buttonComponents.push(
      new ButtonBuilder().setCustomId('del-yes').setLabel('Yes, Delete Them').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('del-cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
  }

  const buttonRow = new ActionRowBuilder().addComponents(buttonComponents);

  const response = await interaction.editReply({ 
    content: null, 
    embeds: [confirmEmbed], 
    components: [buttonRow] 
  });

  let btnInteraction;
  try {
    btnInteraction = await response.awaitMessageComponent({
      filter: i => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: 60000,
    });
  } catch (err) {
    await interaction.editReply({ content: '❌ Cancelled: Confirmation timed out.', embeds: [], components: [] });
    return;
  }

  if (btnInteraction.customId === 'del-cancel') {
    await btnInteraction.update({ content: '❌ Cancelled: Deletion aborted.', embeds: [], components: [] });
    return;
  }

  await btnInteraction.deferUpdate();
  await interaction.editReply({ content: '⚙️ Deleting selected items, please wait...', embeds: [], components: [] });

  const itemsToDelete = new Set(selectedChannelIds);
  if (btnInteraction.customId === 'del-all') {
    for (const childId of allChildrenIds) {
      itemsToDelete.add(childId);
    }
  }

  const deletionQueue = [...itemsToDelete].map(id => guild.channels.cache.get(id)).filter(Boolean);
  deletionQueue.sort((a, b) => {
    if (a.type === ChannelType.GuildCategory && b.type !== ChannelType.GuildCategory) return 1;
    if (a.type !== ChannelType.GuildCategory && b.type === ChannelType.GuildCategory) return -1;
    return 0;
  });

  const stats = { deleted: 0, failed: 0 };
  const errors = [];

  for (const channel of deletionQueue) {
    try {
      if (guild.afkChannelId === channel.id) {
        await guild.setAFKChannel(null);
      }
      await channel.delete('/channel bulkdelete: automated deletion');
      stats.deleted++;
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (err) {
      stats.failed++;
      errors.push(`Item **${channel.name}**: ${err.message}`);
    }
  }

  const summaryEmbed = new EmbedBuilder()
    .setTitle('🗑️ Deletion Summary')
    .setColor(errors.length ? 0xE67E22 : 0x2ECC71)
    .addFields(
      { name: 'Deleted successfully', value: `${stats.deleted}`, inline: true },
      { name: 'Failed to delete', value: `${stats.failed}`, inline: true }
    )
    .setTimestamp();

  if (errors.length) {
    summaryEmbed.addFields({ name: '⚠️ Errors', value: errors.map(e => `• ${e}`).join('\n').slice(0, 1024) });
  }

  await interaction.editReply({ content: null, embeds: [summaryEmbed] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Channel management utilities dashboard (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const { guild } = interaction;

    if (!guild) {
      return interaction.reply({
        content: '❌ This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Verify bot permissions
    const botMember = guild.members.me;
    const missing = [];
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) missing.push('Manage Channels');
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles))    missing.push('Manage Roles');

    if (missing.length) {
      return interaction.reply({
        content: `❌ I'm missing the following permission(s): **${missing.join(', ')}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Helper: Dashboard embed
    function getDashboardEmbed() {
      const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
      const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
      const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

      return new EmbedBuilder()
        .setTitle('📁 Server Channel Dashboard')
        .setDescription('Create standard structured layouts with styled fonts or delete channels in bulk.')
        .setColor(0x3498DB)
        .addFields(
          { name: 'Categories', value: `\`${categories}\``, inline: true },
          { name: 'Text Channels', value: `\`${textChannels}\``, inline: true },
          { name: 'Voice Channels', value: `\`${voiceChannels}\``, inline: true }
        )
        .setFooter({ text: 'Select an action from the dropdown menu.' })
        .setTimestamp();
    }

    // Helper: Dashboard controls (Main Dropdown)
    function getDashboardRows() {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('channel-action-select')
        .setPlaceholder('Choose a channel utility')
        .addOptions([
          { label: 'Create Structured Layout', value: 'action_setup', emoji: '➕', description: 'Build layout with category/roles/channels' },
          { label: 'Delete Channel or Category', value: 'action_delete_single', emoji: '🗑️', description: 'Select a target channel to delete' },
          { label: 'Bulk Delete / Clean Server', value: 'action_bulk_delete', emoji: '🧹', description: 'Pick multiple channels or wipe layouts' }
        ]);

      const closeBtn = new ButtonBuilder()
        .setCustomId('channel-dashboard-close')
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
      time: 600000 // 10 minutes active
    });

    collector.on('collect', async i => {
      try {
        if (!i.isDeferred && !i.isReplied) {
          await i.deferUpdate();
        }

        // Close menu
        if (i.customId === 'channel-dashboard-close') {
          collector.stop();
          return;
        }

        // Home navigation button
        if (i.customId === 'channel-home') {
          await interaction.editReply({
            content: null,
            embeds: [getDashboardEmbed()],
            components: getDashboardRows()
          });
          return;
        }

        // Dropdown actions
        if (i.customId === 'channel-action-select') {
          const action = i.values[0];

          if (action === 'action_setup') {
            const fontMenu = new StringSelectMenuBuilder()
              .setCustomId('channel-setup-font-select')
              .setPlaceholder('Pick a font style for channels')
              .addOptions(
                FONT_STYLES.map(s => ({
                  label: s.label,
                  description: `e.g. ${formatText('welcome', s.value).slice(0, 50)}`,
                  value: s.value,
                  emoji: s.emoji ? { name: s.emoji } : undefined,
                }))
              );

            const backBtn = new ButtonBuilder()
              .setCustomId('channel-home')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              content: '🎨 **Select a font style** for your new gaming layout.\nA preview will show up before we build.',
              embeds: [],
              components: [
                new ActionRowBuilder().addComponents(fontMenu),
                new ActionRowBuilder().addComponents(backBtn)
              ]
            });
          }

          else if (action === 'action_delete_single') {
            const channelSelect = new ChannelSelectMenuBuilder()
              .setCustomId('channel-delete-picker')
              .setPlaceholder('Select a channel or category to delete');

            const backBtn = new ButtonBuilder()
              .setCustomId('channel-home')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              content: '🗑️ **Select the channel or category you want to delete:**',
              embeds: [],
              components: [
                new ActionRowBuilder().addComponents(channelSelect),
                new ActionRowBuilder().addComponents(backBtn)
              ]
            });
          }

          else if (action === 'action_bulk_delete') {
            const channelSelect = new ChannelSelectMenuBuilder()
              .setCustomId('channel-bulk-picker')
              .setPlaceholder('Select channels to delete (multi-select)')
              .setMinValues(1)
              .setMaxValues(25);

            const wipeBtn = new ButtonBuilder()
              .setCustomId('channel-wipe-all-btn')
              .setLabel('⚠️ Wipe Server Channels')
              .setStyle(ButtonStyle.Danger);

            const backBtn = new ButtonBuilder()
              .setCustomId('channel-home')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              content: '🧹 **Select channels to bulk-delete or click the button to wipe the layout:**',
              embeds: [],
              components: [
                new ActionRowBuilder().addComponents(channelSelect),
                new ActionRowBuilder().addComponents(wipeBtn, backBtn)
              ]
            });
          }
        }

        // Action Setup: Font selected
        if (i.customId === 'channel-setup-font-select') {
          const selectedStyle = i.values[0];
          const preview = buildPreview(selectedStyle);
          const styleMeta = FONT_STYLES.find(s => s.value === selectedStyle);

          const confirmBtn = new ButtonBuilder()
            .setCustomId(`setup-confirm-${selectedStyle}`)
            .setLabel('✅ Confirm & Build')
            .setStyle(ButtonStyle.Success);

          const backBtn = new ButtonBuilder()
            .setCustomId('channel-home')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

          await interaction.editReply({
            content: [
              `🔤 **Style selected:** ${styleMeta.emoji} ${styleMeta.label}`,
              '```',
              preview.replace(/\*\*/g, ''),
              '```',
              'Press **Confirm & Build** to create channels, or **Cancel** to abort.',
            ].join('\n'),
            components: [
              new ActionRowBuilder().addComponents(confirmBtn, backBtn)
            ]
          });
        }

        // Action Setup: Confirm build
        if (i.customId.startsWith('setup-confirm-')) {
          const selectedStyle = i.customId.replace('setup-confirm-', '');
          await interaction.editReply({ content: '⚙️ Creating server layout, please wait...', components: [] });

          const stats = { rolesCreated: 0, rolesSkipped: 0, categoriesCreated: 0, categoriesSkipped: 0, channelsCreated: 0, channelsSkipped: 0 };
          const errors = [];
          const roleMap = {};

          // Role Creation
          for (const roleDef of ROLES) {
            const existing = guild.roles.cache.find(r => r.name.toLowerCase() === roleDef.name.toLowerCase());
            if (existing) {
              roleMap[roleDef.name] = existing;
              stats.rolesSkipped++;
              continue;
            }
            try {
              const newRole = await guild.roles.create({
                name: roleDef.name,
                color: roleDef.color,
                permissions: roleDef.permissions,
                reason: '/channel setup: automated role creation',
              });
              roleMap[roleDef.name] = newRole;
              stats.rolesCreated++;
            } catch (err) {
              errors.push(`Role **${roleDef.name}**: ${err.message}`);
            }
          }

          // Category & Channel Creation
          for (const categoryDef of SERVER_LAYOUT) {
            const formattedCategoryName = formatText(categoryDef.name, selectedStyle);
            let categoryChannel = guild.channels.cache.find(ch => ch.type === ChannelType.GuildCategory && ch.name === formattedCategoryName);

            if (categoryChannel) {
              stats.categoriesSkipped++;
            } else {
              try {
                categoryChannel = await guild.channels.create({
                  name: formattedCategoryName,
                  type: ChannelType.GuildCategory,
                  reason: '/channel setup: category creation',
                });
                stats.categoriesCreated++;
              } catch (err) {
                errors.push(`Category **${formattedCategoryName}**: ${err.message}`);
                continue;
              }
            }

            for (const chDef of categoryDef.channels) {
              const formattedChannelName = formatText(chDef.name, selectedStyle);
              const alreadyExists = guild.channels.cache.find(ch => ch.name.toLowerCase() === formattedChannelName.toLowerCase() && ch.parentId === categoryChannel.id);

              if (alreadyExists) {
                stats.channelsSkipped++;
                continue;
              }

              try {
                const options = {
                  name: formattedChannelName,
                  type: chDef.type,
                  parent: categoryChannel.id,
                  topic: chDef.topic || undefined,
                  reason: '/channel setup: channel creation',
                };

                if (chDef.readOnly) {
                  const overwrites = [{ id: guild.id, deny: [PermissionsBitField.Flags.SendMessages] }];
                  if (roleMap['Admin']) {
                    overwrites.push({ id: roleMap['Admin'].id, allow: [PermissionsBitField.Flags.SendMessages] });
                  }
                  if (roleMap['Moderator']) {
                    overwrites.push({ id: roleMap['Moderator'].id, allow: [PermissionsBitField.Flags.SendMessages] });
                  }
                  options.permissionOverwrites = overwrites;
                }

                const created = await guild.channels.create(options);
                stats.channelsCreated++;

                if (chDef.isAFK) {
                  try {
                    await guild.setAFKChannel(created);
                  } catch (err) {
                    errors.push(`AFK setting: ${err.message}`);
                  }
                }
              } catch (err) {
                errors.push(`Channel **${formattedChannelName}**: ${err.message}`);
              }
            }
          }

          const summaryEmbed = new EmbedBuilder()
            .setTitle('🛠️ Server Setup Complete')
            .setColor(0x2ECC71)
            .addFields(
              { name: '👥 Roles', value: `Created: **${stats.rolesCreated}**\nSkipped: **${stats.rolesSkipped}**`, inline: true },
              { name: '📁 Categories', value: `Created: **${stats.categoriesCreated}**\nSkipped: **${stats.categoriesSkipped}**`, inline: true },
              { name: '💬 Channels', value: `Created: **${stats.channelsCreated}**\nSkipped: **${stats.channelsSkipped}**`, inline: true }
            )
            .setTimestamp();

          if (errors.length) {
            summaryEmbed.addFields({ name: '⚠️ Errors', value: errors.map(e => `• ${e}`).join('\n').slice(0, 1024) }).setColor(0xE67E22);
          }

          await interaction.editReply({ content: null, embeds: [summaryEmbed] });
        }

        // Action Delete Single: Selected
        if (i.customId === 'channel-delete-picker') {
          const channelId = i.values[0];
          await confirmAndExecuteDeletion(guild, [channelId], interaction);
        }

        // Action Bulk Delete: Selected channels
        if (i.customId === 'channel-bulk-picker') {
          const channelIds = i.values;
          await confirmAndExecuteDeletion(guild, channelIds, interaction);
        }

        // Action Wipe All: Confirmation prompt
        if (i.customId === 'channel-wipe-all-btn') {
          const confirmBtn = new ButtonBuilder()
            .setCustomId('channel-wipe-confirm-yes')
            .setLabel('⚠️ YES, WIPE ENTIRE SERVER layout')
            .setStyle(ButtonStyle.Danger);

          const cancelBtn = new ButtonBuilder()
            .setCustomId('channel-home')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary);

          await interaction.editReply({
            content: '🚨 **CRITICAL WARNING:** This will delete **ALL channels and categories** in this server! This action is irreversible. Are you sure you want to proceed?',
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(confirmBtn, cancelBtn)
            ]
          });
        }

        // Action Wipe All: Execute
        if (i.customId === 'channel-wipe-confirm-yes') {
          await interaction.editReply({ content: '⚙️ Wiping all server channels, please wait...', components: [] });
          const allGuildChannels = [...guild.channels.cache.keys()];
          await confirmAndExecuteDeletion(guild, allGuildChannels, interaction);
        }

      } catch (err) {
        console.error('Channel Dashboard interaction error:', err);
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [], content: null }).catch(() => {});
    });
  }
};
