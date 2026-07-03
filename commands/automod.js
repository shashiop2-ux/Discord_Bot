const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  MessageFlags, 
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType
} = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Auto-Moderation dashboard and control panel (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const { guild } = interaction;

    if (!guild) {
      return interaction.reply({
        content: '❌ This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Helper: Generate main dashboard embed
    function getDashboardEmbed() {
      const settings = db.getGuild(guild.id);
      const automod = settings.autoMod || {};
      const status = automod.enabled ? '✅ **ACTIVE**' : '❌ **DISABLED**';
      const threshold = automod.spamThreshold || 75;
      
      const filterCount = automod.filters?.length || 0;
      const blockedCount = automod.blockedWords?.length || 0;
      const allowedCount = automod.allowedWords?.length || 0;

      return new EmbedBuilder()
        .setTitle('🛡️ Auto-Moderation Control Panel')
        .setDescription('Configure blocklists, allowlists, keyword filters, and spam heuristics sensitivity.')
        .setColor(0xE74C3C)
        .addFields(
          { name: 'Engine Status', value: status, inline: true },
          { name: 'Spam Heuristic Threshold', value: `\`${threshold}%\``, inline: true },
          { name: '\u200B', value: '\u200B', inline: true },
          { name: 'Regex Filters', value: `\`${filterCount}\` rules`, inline: true },
          { name: 'Blocked Phrases', value: `\`${blockedCount}\` words`, inline: true },
          { name: 'Allowed Exemptions', value: `\`${allowedCount}\` words`, inline: true }
        )
        .setFooter({ text: 'Select a management option from the dropdown menu.' })
        .setTimestamp();
    }

    // Helper: Dashboard controls (Main Dropdown)
    function getDashboardRows() {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('automod-action-select')
        .setPlaceholder('Choose a configuration task')
        .addOptions([
          { label: 'Toggle Status & Heuristics', value: 'nav_heuristics', emoji: '⚙️', description: 'Enable/Disable AutoMod or adjust threshold' },
          { label: 'Manage Regex Filters', value: 'nav_regex', emoji: '🔍', description: 'Add, remove, or list keyword pattern rules' },
          { label: 'Manage Toxicity Words', value: 'nav_words', emoji: '📚', description: 'Configure custom blocked and allowed words' }
        ]);

      const closeBtn = new ButtonBuilder()
        .setCustomId('automod-close')
        .setLabel('Close Panel')
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

    // Sub-menus state tracker
    let currentNav = 'home';
    let selectedRegexAction = 'delete'; // Temp variable to track action during regex modal trigger

    collector.on('collect', async i => {
      try {
        const settings = db.getGuild(guild.id);
        const automod = settings.autoMod;
        if (!automod.blockedWords) automod.blockedWords = [];
        if (!automod.allowedWords) automod.allowedWords = [];

        // Close panel
        if (i.customId === 'automod-close') {
          collector.stop();
          return;
        }

        // Home navigation button
        if (i.customId === 'automod-home') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          currentNav = 'home';
          await interaction.editReply({
            content: null,
            embeds: [getDashboardEmbed()],
            components: getDashboardRows()
          });
          return;
        }

        // Handle Main Navigation Dropdown
        if (i.customId === 'automod-action-select') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          const targetNav = i.values[0];

          if (targetNav === 'nav_heuristics') {
            currentNav = 'heuristics';
            
            const toggleBtn = new ButtonBuilder()
              .setCustomId('heuristics-toggle')
              .setLabel(automod.enabled ? 'Disable AutoMod' : 'Enable AutoMod')
              .setStyle(automod.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
              .setEmoji(automod.enabled ? '⏹️' : '▶️');

            const thresholdBtn = new ButtonBuilder()
              .setCustomId('heuristics-threshold')
              .setLabel('Adjust Threshold')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('📊');

            const backBtn = new ButtonBuilder()
              .setCustomId('automod-home')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('⚙️ Heuristics & Status Settings')
                  .setDescription(`Toggle Auto-Moderation capabilities or change the spam heuristics threshold. Lower threshold numbers are more aggressive.`)
                  .setColor(0xE74C3C)
                  .addFields(
                    { name: 'Enabled Status', value: automod.enabled ? '✅ YES' : '❌ NO', inline: true },
                    { name: 'Spam/Toxicity Threshold', value: `\`${automod.spamThreshold || 75}%\``, inline: true }
                  )
              ],
              components: [
                new ActionRowBuilder().addComponents(toggleBtn, thresholdBtn),
                new ActionRowBuilder().addComponents(backBtn)
              ]
            });
          }

          else if (targetNav === 'nav_regex') {
            currentNav = 'regex';
            await showRegexPanel(interaction, automod);
          }

          else if (targetNav === 'nav_words') {
            currentNav = 'words';
            await showWordsPanel(interaction, automod);
          }
        }

        // Heuristics: Toggle settings click
        if (i.customId === 'heuristics-toggle') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          automod.enabled = !automod.enabled;
          db.setGuild(guild.id, settings);

          const toggleBtn = new ButtonBuilder()
            .setCustomId('heuristics-toggle')
            .setLabel(automod.enabled ? 'Disable AutoMod' : 'Enable AutoMod')
            .setStyle(automod.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
            .setEmoji(automod.enabled ? '⏹️' : '▶️');

          const thresholdBtn = new ButtonBuilder()
            .setCustomId('heuristics-threshold')
            .setLabel('Adjust Threshold')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📊');

          const backBtn = new ButtonBuilder()
            .setCustomId('automod-home')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle('⚙️ Heuristics & Status Settings')
                .setDescription(`Toggle Auto-Moderation capabilities or change the spam heuristics threshold. Lower threshold numbers are more aggressive.`)
                .setColor(0xE74C3C)
                .addFields(
                  { name: 'Enabled Status', value: automod.enabled ? '✅ YES' : '❌ NO', inline: true },
                  { name: 'Spam/Toxicity Threshold', value: `\`${automod.spamThreshold || 75}%\``, inline: true }
                )
            ],
            components: [
              new ActionRowBuilder().addComponents(toggleBtn, thresholdBtn),
              new ActionRowBuilder().addComponents(backBtn)
            ]
          });
        }

        // Heuristics: Modal Trigger for Threshold
        if (i.customId === 'heuristics-threshold') {
          const modal = new ModalBuilder()
            .setCustomId('modal-heuristics-threshold')
            .setTitle('Adjust Sensitivity Threshold');

          const thresholdInput = new TextInputBuilder()
            .setCustomId('threshold-value')
            .setLabel('Heuristic Spam Threshold (10-100)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('75')
            .setMinLength(2)
            .setMaxLength(3)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(thresholdInput));
          await i.showModal(modal);

          try {
            const submit = await i.awaitModalSubmit({
              filter: mi => mi.user.id === interaction.user.id && mi.customId === 'modal-heuristics-threshold',
              time: 60000
            });
            await submit.deferUpdate();

            const val = parseInt(submit.fields.getTextInputValue('threshold-value').trim());
            if (isNaN(val) || val < 10 || val > 100) {
              await interaction.followUp({ content: '❌ Invalid input: Threshold must be a number between 10 and 100.', flags: MessageFlags.Ephemeral });
              return;
            }

            automod.spamThreshold = val;
            db.setGuild(guild.id, settings);

            // Re-render sub-menu
            const toggleBtn = new ButtonBuilder()
              .setCustomId('heuristics-toggle')
              .setLabel(automod.enabled ? 'Disable AutoMod' : 'Enable AutoMod')
              .setStyle(automod.enabled ? ButtonStyle.Danger : ButtonStyle.Success);
            const thresholdBtn = new ButtonBuilder()
              .setCustomId('heuristics-threshold')
              .setLabel('Adjust Threshold')
              .setStyle(ButtonStyle.Primary);
            const backBtn = new ButtonBuilder()
              .setCustomId('automod-home')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('⚙️ Heuristics & Status Settings')
                  .setColor(0xE74C3C)
                  .addFields(
                    { name: 'Enabled Status', value: automod.enabled ? '✅ YES' : '❌ NO', inline: true },
                    { name: 'Spam/Toxicity Threshold', value: `\`${automod.spamThreshold}%\``, inline: true }
                  )
              ],
              components: [
                new ActionRowBuilder().addComponents(toggleBtn, thresholdBtn),
                new ActionRowBuilder().addComponents(backBtn)
              ]
            });

          } catch (e) {
            // Modal timed out or ignored
          }
        }

        // Regex: Select action before modal
        if (i.customId === 'regex-add-trigger') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          const actionSelect = new StringSelectMenuBuilder()
            .setCustomId('regex-action-picker')
            .setPlaceholder('Choose the action for matching messages')
            .addOptions([
              { label: 'Delete message only', value: 'delete', emoji: '🗑️' },
              { label: 'Delete & Warn user', value: 'warn', emoji: '⚠️' },
              { label: 'Delete & Timeout user (10m)', value: 'timeout', emoji: '🚫' },
              { label: 'Log only (no deletion)', value: 'log', emoji: '📝' }
            ]);

          const backBtn = new ButtonBuilder()
            .setCustomId('regex-back-to-panel')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

          await interaction.editReply({
            content: '📌 **Step 1: Choose the moderation action:**',
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(actionSelect),
              new ActionRowBuilder().addComponents(backBtn)
            ]
          });
        }

        // Regex: Modal trigger for pattern input
        if (i.customId === 'regex-action-picker') {
          selectedRegexAction = i.values[0];

          const modal = new ModalBuilder()
            .setCustomId('modal-regex-add')
            .setTitle('Add Regex Filter Pattern');

          const regexInput = new TextInputBuilder()
            .setCustomId('regex-pattern')
            .setLabel('Regex Expression Pattern')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('badword|offensivephrase')
            .setMinLength(1)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(regexInput));
          await i.showModal(modal);

          try {
            const submit = await i.awaitModalSubmit({
              filter: mi => mi.user.id === interaction.user.id && mi.customId === 'modal-regex-add',
              time: 120000
            });
            await submit.deferUpdate();

            const patternStr = submit.fields.getTextInputValue('regex-pattern').trim();
            try {
              new RegExp(patternStr);
            } catch (err) {
              await interaction.followUp({ content: `❌ Invalid regex pattern syntax: **${err.message}**`, flags: MessageFlags.Ephemeral });
              await showRegexPanel(interaction, automod);
              return;
            }

            const exists = automod.filters.some(f => f.regex === patternStr);
            if (exists) {
              await interaction.followUp({ content: '❌ This regex filter pattern already exists.', flags: MessageFlags.Ephemeral });
              await showRegexPanel(interaction, automod);
              return;
            }

            automod.filters.push({ regex: patternStr, action: selectedRegexAction });
            db.setGuild(guild.id, settings);

            await interaction.followUp({ content: `✅ Added regex filter \`${patternStr}\` with action **${selectedRegexAction.toUpperCase()}**.`, flags: MessageFlags.Ephemeral });
            await showRegexPanel(interaction, automod);

          } catch (e) {
            await showRegexPanel(interaction, automod);
          }
        }

        // Regex: Remove filter selection dropdown
        if (i.customId === 'regex-remove-trigger') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();

          if (automod.filters.length === 0) {
            await interaction.followUp({ content: '❌ There are no regex filters to remove.', flags: MessageFlags.Ephemeral });
            return;
          }

          const removeMenu = new StringSelectMenuBuilder()
            .setCustomId('regex-remove-picker')
            .setPlaceholder('Select a regex pattern to delete')
            .addOptions(
              automod.filters.slice(0, 25).map(f => ({
                label: f.regex.slice(0, 25),
                description: `Action: ${f.action.toUpperCase()}`,
                value: f.regex
              }))
            );

          const backBtn = new ButtonBuilder()
            .setCustomId('regex-back-to-panel')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

          await interaction.editReply({
            content: '🗑️ **Select the regex pattern you want to delete:**',
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(removeMenu),
              new ActionRowBuilder().addComponents(backBtn)
            ]
          });
        }

        // Regex: Execute delete
        if (i.customId === 'regex-remove-picker') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          const targetRegex = i.values[0];
          const index = automod.filters.findIndex(f => f.regex === targetRegex);

          if (index !== -1) {
            automod.filters.splice(index, 1);
            db.setGuild(guild.id, settings);
            await interaction.followUp({ content: `✅ Removed regex filter: \`${targetRegex}\``, flags: MessageFlags.Ephemeral });
          }

          await showRegexPanel(interaction, automod);
        }

        // Regex: Back button helpers
        if (i.customId === 'regex-back-to-panel') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          await showRegexPanel(interaction, automod);
        }

        // Words: Modal Block trigger
        if (i.customId === 'words-block-trigger') {
          const modal = new ModalBuilder()
            .setCustomId('modal-words-block')
            .setTitle('Block Custom Phrase');

          const textInput = new TextInputBuilder()
            .setCustomId('blocked-word-val')
            .setLabel('Word or phrase to block')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('examplebadword')
            .setMinLength(1)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(textInput));
          await i.showModal(modal);

          try {
            const submit = await i.awaitModalSubmit({
              filter: mi => mi.user.id === interaction.user.id && mi.customId === 'modal-words-block',
              time: 60000
            });
            await submit.deferUpdate();

            const word = submit.fields.getTextInputValue('blocked-word-val').trim().toLowerCase();
            if (!word) return;

            if (automod.blockedWords.includes(word)) {
              await interaction.followUp({ content: `❌ \`${word}\` is already blocked.`, flags: MessageFlags.Ephemeral });
              await showWordsPanel(interaction, automod);
              return;
            }

            automod.blockedWords.push(word);
            db.setGuild(guild.id, settings);

            await interaction.followUp({ content: `✅ Custom word \`${word}\` blocked successfully.`, flags: MessageFlags.Ephemeral });
            await showWordsPanel(interaction, automod);

          } catch (e) {
            await showWordsPanel(interaction, automod);
          }
        }

        // Words: Modal Allow trigger
        if (i.customId === 'words-allow-trigger') {
          const modal = new ModalBuilder()
            .setCustomId('modal-words-allow')
            .setTitle('Allowlist Phrase (Exempt)');

          const textInput = new TextInputBuilder()
            .setCustomId('allowed-word-val')
            .setLabel('Word or phrase to exempt')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('allowlistedword')
            .setMinLength(1)
            .setRequired(true);

          modal.addComponents(new ActionRowBuilder().addComponents(textInput));
          await i.showModal(modal);

          try {
            const submit = await i.awaitModalSubmit({
              filter: mi => mi.user.id === interaction.user.id && mi.customId === 'modal-words-allow',
              time: 60000
            });
            await submit.deferUpdate();

            const word = submit.fields.getTextInputValue('allowed-word-val').trim().toLowerCase();
            if (!word) return;

            if (automod.allowedWords.includes(word)) {
              await interaction.followUp({ content: `❌ \`${word}\` is already on the allowlist.`, flags: MessageFlags.Ephemeral });
              await showWordsPanel(interaction, automod);
              return;
            }

            automod.allowedWords.push(word);
            db.setGuild(guild.id, settings);

            await interaction.followUp({ content: `✅ Word \`${word}\` added to allowlist exemptions.`, flags: MessageFlags.Ephemeral });
            await showWordsPanel(interaction, automod);

          } catch (e) {
            await showWordsPanel(interaction, automod);
          }
        }

        // Words: Unblock Selection dropdown
        if (i.customId === 'words-unblock-trigger') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();

          if (automod.blockedWords.length === 0) {
            await interaction.followUp({ content: '❌ There are no custom blocked words to remove.', flags: MessageFlags.Ephemeral });
            return;
          }

          const removeMenu = new StringSelectMenuBuilder()
            .setCustomId('words-unblock-picker')
            .setPlaceholder('Select a blocked word to delete')
            .addOptions(
              automod.blockedWords.slice(0, 25).map(w => ({ label: w, value: w }))
            );

          const backBtn = new ButtonBuilder()
            .setCustomId('words-back-to-panel')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

          await interaction.editReply({
            content: '🗑️ **Select the blocked word you want to unblock:**',
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(removeMenu),
              new ActionRowBuilder().addComponents(backBtn)
            ]
          });
        }

        // Words: Execute Unblock
        if (i.customId === 'words-unblock-picker') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          const targetWord = i.values[0];
          const index = automod.blockedWords.indexOf(targetWord);

          if (index !== -1) {
            automod.blockedWords.splice(index, 1);
            db.setGuild(guild.id, settings);
            await interaction.followUp({ content: `✅ Unblocked word: \`${targetWord}\``, flags: MessageFlags.Ephemeral });
          }

          await showWordsPanel(interaction, automod);
        }

        // Words: Unallow Selection dropdown
        if (i.customId === 'words-unallow-trigger') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();

          if (automod.allowedWords.length === 0) {
            await interaction.followUp({ content: '❌ There are no allowlisted words to remove.', flags: MessageFlags.Ephemeral });
            return;
          }

          const removeMenu = new StringSelectMenuBuilder()
            .setCustomId('words-unallow-picker')
            .setPlaceholder('Select an exempt word to delete')
            .addOptions(
              automod.allowedWords.slice(0, 25).map(w => ({ label: w, value: w }))
            );

          const backBtn = new ButtonBuilder()
            .setCustomId('words-back-to-panel')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

          await interaction.editReply({
            content: '🗑️ **Select the word you want to remove from the allowlist:**',
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(removeMenu),
              new ActionRowBuilder().addComponents(backBtn)
            ]
          });
        }

        // Words: Execute Unallow
        if (i.customId === 'words-unallow-picker') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          const targetWord = i.values[0];
          const index = automod.allowedWords.indexOf(targetWord);

          if (index !== -1) {
            automod.allowedWords.splice(index, 1);
            db.setGuild(guild.id, settings);
            await interaction.followUp({ content: `✅ Removed \`${targetWord}\` from allowlist.`, flags: MessageFlags.Ephemeral });
          }

          await showWordsPanel(interaction, automod);
        }

        // Words: Back button helper
        if (i.customId === 'words-back-to-panel') {
          if (!i.isDeferred && !i.isReplied) await i.deferUpdate();
          await showWordsPanel(interaction, automod);
        }

      } catch (err) {
        console.error('AutoMod control panel error:', err);
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [], content: null }).catch(() => {});
    });
  }
};

// Helper: Render Regex Panel
async function showRegexPanel(interaction, automod) {
  const embed = new EmbedBuilder()
    .setTitle('🔍 Manage Regex Filters')
    .setDescription(
      automod.filters.length > 0 
        ? automod.filters.map((f, index) => `**${index + 1}.** \`${f.regex}\` ➔ Action: **${f.action.toUpperCase()}**`).join('\n')
        : '*No active regex filters configured.*'
    )
    .setColor(0xE74C3C);

  const addBtn = new ButtonBuilder()
    .setCustomId('regex-add-trigger')
    .setLabel('Add Filter')
    .setStyle(ButtonStyle.Success)
    .setEmoji('➕');

  const removeBtn = new ButtonBuilder()
    .setCustomId('regex-remove-trigger')
    .setLabel('Remove Filter')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('➖');

  const backBtn = new ButtonBuilder()
    .setCustomId('automod-home')
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);

  await interaction.editReply({
    content: null,
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(addBtn, removeBtn),
      new ActionRowBuilder().addComponents(backBtn)
    ]
  });
}

// Helper: Render Custom Words Block/Allow Panel
async function showWordsPanel(interaction, automod) {
  const embed = new EmbedBuilder()
    .setTitle('📚 Manage Blocked & Allowed Words')
    .setColor(0xE74C3C)
    .addFields(
      { 
        name: '🚫 Custom Blocked Words', 
        value: automod.blockedWords.map(w => `\`${w}\``).join(', ') || '*No custom blocked words configured.*',
        inline: false
      },
      { 
        name: '✅ Exempt/Allowlisted Words', 
        value: automod.allowedWords.map(w => `\`${w}\``).join(', ') || '*No allowlisted words configured.*',
        inline: false 
      }
    );

  const blockBtn = new ButtonBuilder()
    .setCustomId('words-block-trigger')
    .setLabel('Block Word')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🚫');

  const unblockBtn = new ButtonBuilder()
    .setCustomId('words-unblock-trigger')
    .setLabel('Unblock Word')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔓');

  const allowBtn = new ButtonBuilder()
    .setCustomId('words-allow-trigger')
    .setLabel('Allowlist Word')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅');

  const unallowBtn = new ButtonBuilder()
    .setCustomId('words-unallow-trigger')
    .setLabel('Remove Allowed')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('❌');

  const backBtn = new ButtonBuilder()
    .setCustomId('automod-home')
    .setLabel('Back')
    .setStyle(ButtonStyle.Secondary);

  await interaction.editReply({
    content: null,
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(blockBtn, unblockBtn),
      new ActionRowBuilder().addComponents(allowBtn, unallowBtn),
      new ActionRowBuilder().addComponents(backBtn)
    ]
  });
}
