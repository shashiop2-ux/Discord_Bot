const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  ComponentType
} = require('discord.js');
const db = require('../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('karma')
    .setDescription('Meme Karma system dashboard, stats, and leaderboard'),

  async execute(interaction) {
    const { guild, user } = interaction;

    if (!guild) {
      return interaction.reply({
        content: '❌ This command can only be used inside a server.',
        flags: MessageFlags.Ephemeral
      });
    }

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    // Helper: Retrieve user profile statistics
    function getUserStats(userId) {
      const settings = db.getGuild(guild.id);
      const userKarma = settings.userKarma || {};
      return userKarma[userId] || { karma: 0, totalPosts: 0, bestMeme: null };
    }

    // Helper: Generate main dashboard embed
    function getDashboardEmbed(userId) {
      const settings = db.getGuild(guild.id);
      const karmaSettings = settings.karma || {};
      const stats = getUserStats(userId);

      const chDisplay = karmaSettings.channelId ? `<#${karmaSettings.channelId}>` : '🔴 *Not Configured*';
      const hofDisplay = karmaSettings.hallOfFameChannelId ? `<#${karmaSettings.hallOfFameChannelId}>` : '🔴 *Not Configured*';
      const up = karmaSettings.upEmoji || '👍';
      const down = karmaSettings.downEmoji || '👎';

      const embed = new EmbedBuilder()
        .setTitle('👍 Meme Karma Dashboard')
        .setDescription(`Welcome to the Meme Karma center! Post photos/videos in the meme channel, and receive voting karma from the community.`)
        .setColor(0xF1C40F)
        .addFields(
          { name: 'Your Total Karma', value: `\`${stats.karma}\` points`, inline: true },
          { name: 'Your Meme Posts', value: `\`${stats.totalPosts}\` memes`, inline: true },
          { name: 'Best Meme Score', value: stats.bestMeme ? `\`${stats.bestMeme.votes}\` net votes` : '*No votes yet*', inline: true }
        )
        .setTimestamp();

      if (isAdmin) {
        const strictDisplay = karmaSettings.strictMode ? '✅ **Enabled**' : '❌ **Disabled**';
        embed.addFields(
          { name: '⚙️ Configurations (Admins Only)', value: `• Meme Channel: ${chDisplay}\n• Meme Strict Mode: ${strictDisplay}\n• Hall of Fame Channel: ${hofDisplay}\n• Emojis: ${up} / ${down}\n• Role Rewards count: \`${karmaSettings.rewards?.length || 0}\` roles\n• Min Age Anti-Abuse: \`${karmaSettings.joinAgeDays || 0}\` days` }
        );
      }

      return embed;
    }

    // Helper: Generate dashboard components based on permissions
    function getDashboardRows() {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('karma-action-select')
        .setPlaceholder('Choose a task or statistics view');

      selectMenu.addOptions([
        { label: 'View Leaderboard', value: 'nav_leaderboard', emoji: '🏆', description: 'Show the top 10 meme lords on this server' },
        { label: 'Refresh Stats', value: 'nav_stats', emoji: '🔄', description: 'Update and refresh your profile numbers' }
      ]);

      if (isAdmin) {
        selectMenu.addOptions([
          { label: 'Set Meme Channel', value: 'nav_set_channel', emoji: '📂', description: 'Designate channel where memes are tracked' },
          { label: 'Toggle Strict Mode', value: 'nav_toggle_strict', emoji: '🛡️', description: 'Enforce media-only filters in memes channel' },
          { label: 'Set Hall of Fame Channel', value: 'nav_set_hof_channel', emoji: '🎖️', description: 'Repost top memes to a showcase channel' },
          { label: 'Customize Emojis', value: 'nav_set_emojis', emoji: '🎭', description: 'Change reaction emojis used for voting' },
          { label: 'Manage Role Rewards', value: 'nav_set_rewards', emoji: '🎁', description: 'Assign roles when users hit karma thresholds' },
          { label: 'Anti-Abuse Account Age', value: 'nav_set_age', emoji: '🛡️', description: 'Ignore votes from new accounts' }
        ]);
      }

      const closeBtn = new ButtonBuilder()
        .setCustomId('karma-dashboard-close')
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
      embeds: [getDashboardEmbed(user.id)],
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
        const settings = db.getGuild(guild.id);
        const karmaSettings = settings.karma;
        if (!karmaSettings.rewards) karmaSettings.rewards = [];

        if (!i.isDeferred && !i.isReplied) {
          await i.deferUpdate();
        }

        // Close menu
        if (i.customId === 'karma-dashboard-close') {
          collector.stop();
          return;
        }

        // Home button
        if (i.customId === 'karma-home') {
          await interaction.editReply({
            content: null,
            embeds: [getDashboardEmbed(user.id)],
            components: getDashboardRows()
          });
          return;
        }

        // Dropdown Navigation
        if (i.customId === 'karma-action-select') {
          const action = i.values[0];

          if (action === 'nav_stats') {
            await interaction.editReply({
              embeds: [getDashboardEmbed(user.id)],
              components: getDashboardRows()
            });
          }

          else if (action === 'nav_leaderboard') {
            const userKarma = settings.userKarma || {};
            const sorted = Object.entries(userKarma)
              .sort((a, b) => b[1].karma - a[1].karma)
              .slice(0, 10);

            let leaderboardText = '*No users with karma yet.*';
            if (sorted.length > 0) {
              leaderboardText = sorted
                .map(([uid, ustats], idx) => {
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `\`#${idx + 1}\``;
                  return `${medal} <@${uid}> — **${ustats.karma}** karma (\`${ustats.totalPosts}\` post(s))`;
                })
                .join('\n');
            }

            const lbEmbed = new EmbedBuilder()
              .setTitle('🏆 Meme Karma Leaderboard')
              .setDescription(leaderboardText)
              .setColor(0xF1C40F)
              .setTimestamp();

            const backBtn = new ButtonBuilder()
              .setCustomId('karma-home')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              embeds: [lbEmbed],
              components: [new ActionRowBuilder().addComponents(backBtn)]
            });
          }

          else if (action === 'nav_set_channel') {
            const channelSelect = new ChannelSelectMenuBuilder()
              .setCustomId('karma-channel-picker')
              .setPlaceholder('Select a meme channel');

            const backBtn = new ButtonBuilder()
              .setCustomId('karma-home')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              content: '📂 **Select the channel where the bot will auto-react with voting emojis:**',
              embeds: [],
              components: [
                new ActionRowBuilder().addComponents(channelSelect),
                new ActionRowBuilder().addComponents(backBtn)
              ]
            });
          }

          else if (action === 'nav_toggle_strict') {
            karmaSettings.strictMode = !karmaSettings.strictMode;
            db.setGuild(guild.id, settings);

            await interaction.editReply({
              embeds: [getDashboardEmbed(user.id)],
              components: getDashboardRows()
            });
          }

          else if (action === 'nav_set_hof_channel') {
            const channelSelect = new ChannelSelectMenuBuilder()
              .setCustomId('karma-hof-picker')
              .setPlaceholder('Select Hall of Fame channel');

            const backBtn = new ButtonBuilder()
              .setCustomId('karma-home')
              .setLabel('Back')
              .setStyle(ButtonStyle.Secondary);

            await interaction.editReply({
              content: '🎖️ **Select the showcase channel where top memes (>= 5 votes) will be reposted:**',
              embeds: [],
              components: [
                new ActionRowBuilder().addComponents(channelSelect),
                new ActionRowBuilder().addComponents(backBtn)
              ]
            });
          }

          else if (action === 'nav_set_emojis') {
            const modal = new ModalBuilder()
              .setCustomId('modal-karma-emojis')
              .setTitle('Customize Voting Emojis');

            const upInput = new TextInputBuilder()
              .setCustomId('up-emoji-val')
              .setLabel('Upvote Emoji (default 👍)')
              .setStyle(TextInputStyle.Short)
              .setValue(karmaSettings.upEmoji || '👍')
              .setRequired(true);

            const downInput = new TextInputBuilder()
              .setCustomId('down-emoji-val')
              .setLabel('Downvote Emoji (default 👎)')
              .setStyle(TextInputStyle.Short)
              .setValue(karmaSettings.downEmoji || '👎')
              .setRequired(true);

            modal.addComponents(
              new ActionRowBuilder().addComponents(upInput),
              new ActionRowBuilder().addComponents(downInput)
            );

            await i.showModal(modal);

            try {
              const submit = await i.awaitModalSubmit({
                filter: mi => mi.user.id === interaction.user.id && mi.customId === 'modal-karma-emojis',
                time: 60000
              });
              await submit.deferUpdate();

              const up = submit.fields.getTextInputValue('up-emoji-val').trim();
              const down = submit.fields.getTextInputValue('down-emoji-val').trim();

              karmaSettings.upEmoji = up;
              karmaSettings.downEmoji = down;
              db.setGuild(guild.id, settings);

              await interaction.followUp({ content: `✅ Emojis updated! Upvote: ${up}, Downvote: ${down}.`, flags: MessageFlags.Ephemeral });
              await interaction.editReply({
                content: null,
                embeds: [getDashboardEmbed(user.id)],
                components: getDashboardRows()
              });
            } catch (e) {
              // modal ignore
            }
          }

          else if (action === 'nav_set_rewards') {
            await showRewardsPanel(interaction, karmaSettings);
          }

          else if (action === 'nav_set_age') {
            const modal = new ModalBuilder()
              .setCustomId('modal-karma-age')
              .setTitle('Anti-Abuse Account Age');

            const ageInput = new TextInputBuilder()
              .setCustomId('age-days-val')
              .setLabel('Min Guild Join Age (Days, 0 to disable)')
              .setStyle(TextInputStyle.Short)
              .setValue(String(karmaSettings.joinAgeDays || 0))
              .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(ageInput));
            await i.showModal(modal);

            try {
              const submit = await i.awaitModalSubmit({
                filter: mi => mi.user.id === interaction.user.id && mi.customId === 'modal-karma-age',
                time: 60000
              });
              await submit.deferUpdate();

              const days = parseInt(submit.fields.getTextInputValue('age-days-val').trim());
              if (isNaN(days) || days < 0) {
                await interaction.followUp({ content: '❌ Invalid input: Days must be a positive number.', flags: MessageFlags.Ephemeral });
                return;
              }

              karmaSettings.joinAgeDays = days;
              db.setGuild(guild.id, settings);

              await interaction.followUp({ content: `✅ Configured minimum server join age to \`${days}\` days.`, flags: MessageFlags.Ephemeral });
              await interaction.editReply({
                content: null,
                embeds: [getDashboardEmbed(user.id)],
                components: getDashboardRows()
              });
            } catch (e) {
              // ignore modal
            }
          }
        }

        // Action Channel Picker response
        if (i.customId === 'karma-channel-picker') {
          const channelId = i.values[0];
          karmaSettings.channelId = channelId;
          db.setGuild(guild.id, settings);

          await interaction.editReply({
            content: `✅ Successfully set meme channel to <#${channelId}>!`,
            embeds: [getDashboardEmbed(user.id)],
            components: getDashboardRows()
          });
        }

        // Action HoF Picker response
        if (i.customId === 'karma-hof-picker') {
          const channelId = i.values[0];
          karmaSettings.hallOfFameChannelId = channelId;
          db.setGuild(guild.id, settings);

          await interaction.editReply({
            content: `✅ Successfully set Hall of Fame channel to <#${channelId}>!`,
            embeds: [getDashboardEmbed(user.id)],
            components: getDashboardRows()
          });
        }

        // Rewards sub-actions: back
        if (i.customId === 'karma-rewards-back') {
          await interaction.editReply({
            content: null,
            embeds: [getDashboardEmbed(user.id)],
            components: getDashboardRows()
          });
        }

        // Rewards sub-actions: remove selection sub-view
        if (i.customId === 'karma-rewards-remove-trigger') {
          if (karmaSettings.rewards.length === 0) {
            await interaction.followUp({ content: '❌ There are no role rewards configured to remove.', flags: MessageFlags.Ephemeral });
            return;
          }

          const removeMenu = new StringSelectMenuBuilder()
            .setCustomId('karma-rewards-remove-picker')
            .setPlaceholder('Select a reward threshold to delete')
            .addOptions(
              karmaSettings.rewards.slice(0, 25).map((r, index) => {
                const role = guild.roles.cache.get(r.roleId);
                return {
                  label: `${r.threshold} Karma ➔ ${role ? role.name : 'Unknown Role'}`,
                  value: String(index)
                };
              })
            );

          const backBtn = new ButtonBuilder()
            .setCustomId('karma-rewards-back-to-list')
            .setLabel('Back')
            .setStyle(ButtonStyle.Secondary);

          await interaction.editReply({
            content: '🗑️ **Select the role reward you want to delete:**',
            embeds: [],
            components: [
              new ActionRowBuilder().addComponents(removeMenu),
              new ActionRowBuilder().addComponents(backBtn)
            ]
          });
        }

        // Rewards: execute deletion
        if (i.customId === 'karma-rewards-remove-picker') {
          const idx = parseInt(i.values[0]);
          if (!isNaN(idx) && karmaSettings.rewards[idx]) {
            const removed = karmaSettings.rewards.splice(idx, 1)[0];
            db.setGuild(guild.id, settings);
            const role = guild.roles.cache.get(removed.roleId);
            await interaction.followUp({ content: `✅ Deleted reward: **${removed.threshold}** karma for ${role ? role.name : 'Role'}.`, flags: MessageFlags.Ephemeral });
          }
          await showRewardsPanel(interaction, karmaSettings);
        }

        // Rewards sub-actions: add trigger modal
        if (i.customId === 'karma-rewards-add-trigger') {
          const modal = new ModalBuilder()
            .setCustomId('modal-karma-reward-add')
            .setTitle('Add Role Reward');

          const thresholdInput = new TextInputBuilder()
            .setCustomId('reward-threshold')
            .setLabel('Karma Points Threshold')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('100')
            .setRequired(true);

          const roleIdInput = new TextInputBuilder()
            .setCustomId('reward-role-id')
            .setLabel('Role ID to Auto-Assign')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Copy the Role ID from Server Settings')
            .setRequired(true);

          modal.addComponents(
            new ActionRowBuilder().addComponents(thresholdInput),
            new ActionRowBuilder().addComponents(roleIdInput)
          );

          await i.showModal(modal);

          try {
            const submit = await i.awaitModalSubmit({
              filter: mi => mi.user.id === interaction.user.id && mi.customId === 'modal-karma-reward-add',
              time: 60000
            });
            await submit.deferUpdate();

            const threshold = parseInt(submit.fields.getTextInputValue('reward-threshold').trim());
            const roleId = submit.fields.getTextInputValue('reward-role-id').trim();

            if (isNaN(threshold)) {
              await interaction.followUp({ content: '❌ Invalid threshold: must be a number.', flags: MessageFlags.Ephemeral });
              await showRewardsPanel(interaction, karmaSettings);
              return;
            }

            const role = guild.roles.cache.get(roleId);
            if (!role) {
              await interaction.followUp({ content: '❌ Invalid Role ID: Could not locate this role on the server.', flags: MessageFlags.Ephemeral });
              await showRewardsPanel(interaction, karmaSettings);
              return;
            }

            karmaSettings.rewards.push({ threshold, roleId });
            // Sort rewards by threshold ascending
            karmaSettings.rewards.sort((a, b) => a.threshold - b.threshold);
            db.setGuild(guild.id, settings);

            await interaction.followUp({ content: `✅ Configured role reward: Users reaching **${threshold}** karma will receive **${role.name}**!`, flags: MessageFlags.Ephemeral });
            await showRewardsPanel(interaction, karmaSettings);
          } catch (e) {
            await showRewardsPanel(interaction, karmaSettings);
          }
        }

        // Rewards sub-actions: return frompicker
        if (i.customId === 'karma-rewards-back-to-list') {
          await showRewardsPanel(interaction, karmaSettings);
        }

      } catch (err) {
        console.error('Karma Dashboard interaction error:', err);
      }
    });

    collector.on('end', () => {
      interaction.editReply({ components: [], content: null }).catch(() => {});
    });
  }
};

// Helper: Show rewards panel sub-view
async function showRewardsPanel(interaction, karmaSettings) {
  const rewards = karmaSettings.rewards || [];

  const embed = new EmbedBuilder()
    .setTitle('🎁 Manage Role Rewards')
    .setDescription(
      rewards.length > 0 
        ? rewards.map((r, idx) => {
            const role = interaction.guild.roles.cache.get(r.roleId);
            return `**${idx + 1}.** Threshold: **${r.threshold}** karma ➔ Role: ${role ? `<@&${r.roleId}>` : '`Unknown Role` (Deleted)'}`;
          }).join('\n')
        : '*No role rewards configured. Users will not receive automated roles when hitting thresholds.*'
    )
    .setColor(0xF1C40F);

  const addBtn = new ButtonBuilder()
    .setCustomId('karma-rewards-add-trigger')
    .setLabel('Add Reward')
    .setStyle(ButtonStyle.Success)
    .setEmoji('➕');

  const removeBtn = new ButtonBuilder()
    .setCustomId('karma-rewards-remove-trigger')
    .setLabel('Remove Reward')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('➖');

  const backBtn = new ButtonBuilder()
    .setCustomId('karma-home')
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
