const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const db = require('./db');

// Voting window duration (default 24 hours, but customizable for testing)
const VOTING_WINDOW_MS = 24 * 60 * 60 * 1000; 

/**
 * Checks if a message contains a meme (attachment or link) and triggers reactions.
 * @param {Message} message
 */
async function handleMemeReaction(message) {
  const { guild, channel, author } = message;
  if (!guild || author.bot) return;

  const settings = db.getGuild(guild.id);
  const karmaSettings = settings.karma || {};

  // Check if this is the configured meme channel
  if (!karmaSettings.channelId || karmaSettings.channelId !== channel.id) {
    return;
  }

  // Check for attachments or links
  const hasLink = /https?:\/\/[^\s]+/gi.test(message.content);
  const hasAttachment = message.attachments.size > 0;

  if (!hasLink && !hasAttachment) {
    return;
  }

  // Record post in DB
  if (!settings.memes) settings.memes = {};
  settings.memes[message.id] = {
    authorId: author.id,
    channelId: channel.id,
    timestamp: Date.now(),
    processed: false
  };
  db.setGuild(guild.id, settings);

  // Add reactions
  const upEmoji = karmaSettings.upEmoji || '👍';
  const downEmoji = karmaSettings.downEmoji || '👎';

  try {
    await message.react(upEmoji);
    await message.react(downEmoji);
  } catch (err) {
    console.error(`Failed to add meme reactions in guild ${guild.id}:`, err.message);
  }
}

/**
 * Background scanner to process meme votes after the window closes.
 * @param {Client} client
 */
async function scanAndProcessMemes(client) {
  const now = Date.now();

  for (const guild of client.guilds.cache.values()) {
    try {
      const settings = db.getGuild(guild.id);
      const memes = settings.memes || {};
      const karmaSettings = settings.karma || {};
      const userKarma = settings.userKarma || {};
      
      const upEmoji = karmaSettings.upEmoji || '👍';
      const downEmoji = karmaSettings.downEmoji || '👎';
      const joinAgeDays = karmaSettings.joinAgeDays || 0; // Anti-abuse threshold

      let dbChanged = false;

      for (const [messageId, meme] of Object.entries(memes)) {
        // Skip processed posts
        if (meme.processed) continue;

        // Skip posts still inside the voting window
        if (now - meme.timestamp < VOTING_WINDOW_MS) {
          continue;
        }

        const channel = guild.channels.cache.get(meme.channelId);
        if (!channel) {
          // Channel deleted, mark processed
          meme.processed = true;
          dbChanged = true;
          continue;
        }

        try {
          const msg = await channel.messages.fetch(messageId);

          const upReaction = msg.reactions.cache.get(upEmoji);
          const downReaction = msg.reactions.cache.get(downEmoji);

          let upCount = 0;
          let downCount = 0;

          // Process Upvotes
          if (upReaction) {
            const upUsers = await upReaction.users.fetch();
            for (const user of upUsers.values()) {
              if (user.bot || user.id === meme.authorId) continue; // Ignore bots & self-reactions
              
              if (joinAgeDays > 0) {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member) {
                  const daysInServer = (now - member.joinedTimestamp) / (1000 * 60 * 60 * 24);
                  if (daysInServer < joinAgeDays) continue; // Ignore new account votes
                }
              }
              upCount++;
            }
          }

          // Process Downvotes
          if (downReaction) {
            const downUsers = await downReaction.users.fetch();
            for (const user of downUsers.values()) {
              if (user.bot || user.id === meme.authorId) continue; // Ignore bots & self-reactions
              
              if (joinAgeDays > 0) {
                const member = await guild.members.fetch(user.id).catch(() => null);
                if (member) {
                  const daysInServer = (now - member.joinedTimestamp) / (1000 * 60 * 60 * 24);
                  if (daysInServer < joinAgeDays) continue;
                }
              }
              downCount++;
            }
          }

          const netKarma = upCount - downCount;

          // Update User Karma Profile
          if (!userKarma[meme.authorId]) {
            userKarma[meme.authorId] = { karma: 0, totalPosts: 0, bestMeme: null };
          }
          const profile = userKarma[meme.authorId];
          profile.karma += netKarma;
          profile.totalPosts += 1;

          // Check if this is their best meme
          const attachmentUrl = msg.attachments.first()?.url || msg.embeds[0]?.url || '';
          if (!profile.bestMeme || netKarma > profile.bestMeme.votes) {
            profile.bestMeme = {
              messageId,
              votes: netKarma,
              url: attachmentUrl || msg.content
            };
          }

          // Evaluate Rewards (Role assignment)
          const member = await guild.members.fetch(meme.authorId).catch(() => null);
          if (member) {
            const rewards = karmaSettings.rewards || [];
            for (const reward of rewards) {
              const role = guild.roles.cache.get(reward.roleId);
              if (role) {
                const hasRole = member.roles.cache.has(role.id);
                if (profile.karma >= reward.threshold && !hasRole) {
                  await member.roles.add(role, `Meme Karma reward threshold reached (${reward.threshold} karma)`).catch(() => {});
                } else if (profile.karma < reward.threshold && hasRole) {
                  await member.roles.remove(role, `Meme Karma dropped below threshold (${reward.threshold} karma)`).catch(() => {});
                }
              }
            }
          }

          // Repost to Hall of Fame if threshold reached (Net score >= 5)
          if (karmaSettings.hallOfFameChannelId && netKarma >= 5) {
            const hofChannel = guild.channels.cache.get(karmaSettings.hallOfFameChannelId);
            if (hofChannel) {
              const hofEmbed = new EmbedBuilder()
                .setTitle('🏆 Hall of Fame Inductee!')
                .setDescription(msg.content || '*Attached Media Only*')
                .setColor(0xF1C40F)
                .addFields(
                  { name: 'Meme Lord', value: `<@${meme.authorId}>`, inline: true },
                  { name: 'Net Votes', value: `👍 **${netKarma}**`, inline: true }
                )
                .setTimestamp(meme.timestamp);

              if (attachmentUrl) {
                hofEmbed.setImage(attachmentUrl);
              }

              await hofChannel.send({ embeds: [hofEmbed] }).catch(() => {});
            }
          }

          meme.processed = true;
          dbChanged = true;

        } catch (err) {
          if (err.code === 10008) {
            // Message deleted, mark processed to clear queue
            meme.processed = true;
            dbChanged = true;
          } else {
            console.error(`Error processing meme ID ${messageId}:`, err.message);
          }
        }
      }

      if (dbChanged) {
        settings.memes = memes;
        settings.userKarma = userKarma;
        db.setGuild(guild.id, settings);
      }

    } catch (guildErr) {
      console.error(`Error scanning memes for guild ${guild.id}:`, guildErr.message);
    }
  }
}

/**
 * Initializes the background scanner loop.
 * @param {Client} client
 */
function initMemeScanner(client) {
  // Check every 5 minutes
  setInterval(() => {
    scanAndProcessMemes(client);
  }, 5 * 60 * 1000);
  
  // Run immediate scanner task on load
  scanAndProcessMemes(client);
}

/**
 * Enforces strict content filter (media files/links only) in the memes channel.
 * @param {Message} message
 * @returns {Promise<boolean>} True if the message was deleted due to a strict violation
 */
async function handleStrictMemeFilter(message) {
  const { guild, channel, author, member } = message;
  if (!guild || author.bot || message.system) return false;

  const settings = db.getGuild(guild.id);
  const karmaSettings = settings.karma || {};

  // Verify strict filter is enabled for this channel
  if (!karmaSettings.channelId || karmaSettings.channelId !== channel.id || !karmaSettings.strictMode) {
    return false;
  }

  // Bypass moderators / users with Manage Messages permissions
  if (member) {
    const isMod = member.permissions.has(PermissionsBitField ? PermissionsBitField.Flags.ManageMessages : 'ManageMessages');
    if (isMod) return false;
  }

  // Check for attachments or links
  const hasLink = /https?:\/\/[^\s]+/gi.test(message.content);
  const hasAttachment = message.attachments.size > 0;

  if (hasLink || hasAttachment) {
    return false; // Valid meme (with optional caption text)
  }

  // Invalid post! Attempt deletion
  try {
    const botMember = guild.members.me;
    const hasDeletePerm = channel.permissionsFor(botMember)?.has(PermissionsBitField ? PermissionsBitField.Flags.ManageMessages : 'ManageMessages');

    if (!hasDeletePerm) {
      console.warn(`⚠️ Permission Error: Cannot enforce Meme Strict Mode in channel #${channel.name} due to missing "Manage Messages" permissions.`);
      
      // Alert log channel if available
      if (settings.logChannelId) {
        const logChannel = guild.channels.cache.get(settings.logChannelId);
        if (logChannel) {
          await logChannel.send(`⚠️ **Meme Strict Mode Alert:** I failed to delete a non-meme message in ${channel} because I am missing the **Manage Messages** permission.`).catch(() => {});
        }
      }
      return false;
    }

    // Delete message
    await message.delete().catch(() => {});

    // Send temporary self-deleting warning
    const warn = await channel.send(`⚠️ ${author}, this channel is for memes only! Please post an image, video, or link.`).catch(() => {});
    if (warn) {
      setTimeout(() => {
        warn.delete().catch(() => {});
      }, 7000);
    }

    return true; // Deleted successfully
  } catch (err) {
    console.error('Failed to enforce meme strict mode:', err.message);
    return false;
  }
}

module.exports = {
  handleMemeReaction,
  initMemeScanner,
  handleStrictMemeFilter,
  VOTING_WINDOW_MS
};
