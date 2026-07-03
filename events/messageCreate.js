const { Events, EmbedBuilder } = require('discord.js');
const automod = require('../utils/automod');
const db = require('../utils/db');

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    // Ignore direct messages or bot messages
    if (!message.guild || message.author.bot) return;

    // ── 0. Meme Auto-Reaction & Strict Mode checks ───────────────────────────
    const karma = require('../utils/karma');
    const wasStrictDeleted = await karma.handleStrictMemeFilter(message);
    if (wasStrictDeleted) return;

    await karma.handleMemeReaction(message);

    // ── 1. Run Auto-Moderation checks first ──────────────────────────────────
    const wasModerated = await automod.handleAutoMod(message);

    // If message was deleted by AutoMod, content checks should abort
    if (wasModerated) return;

    // ── 2. Run Custom Auto-Responders ────────────────────────────────────────
    const settings = db.getGuild(message.guild.id);
    const responders = settings.autoResponders || [];
    const contentLower = message.content.toLowerCase().trim();

    for (const responder of responders) {
      let isMatch = false;

      if (responder.matchType === 'exact') {
        isMatch = contentLower === responder.trigger;
      } else {
        // 'contains' matching
        isMatch = contentLower.includes(responder.trigger);
      }

      if (isMatch) {
        try {
          if (responder.response.trim() === '{youtube_live}') {
            // Exclude the configured user from triggering the YouTube live check responder
            if (process.env.EXCLUDED_USER_ID && message.author.id === process.env.EXCLUDED_USER_ID) {
              continue;
            }

            const youtube = require('../utils/youtube');
            const status = await youtube.checkLiveStatus();

            if (status.isLive) {
              await message.channel.send(`🔴 CALL is live RIGHT NOW on YouTube! Pull up: ${status.url}`);
            } else {
              await message.channel.send(`😴 CALL's not live at the moment. Here's his channel so you can catch the next stream: ${status.url}`);
            }
          } else {
            if (responder.useEmbed) {
              const embed = new EmbedBuilder()
                .setDescription(responder.response)
                .setColor(0x3498DB);
              await message.channel.send({ embeds: [embed] });
            } else {
              await message.channel.send(responder.response);
            }
          }
        } catch (err) {
          console.error(`AutoResponder failed to send response for trigger "${responder.trigger}":`, err.message);
        }
        // Stop checking after the first trigger match
        break;
      }
    }
  },
};
