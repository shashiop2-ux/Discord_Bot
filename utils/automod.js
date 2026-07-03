const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { DataSet, RegExpMatcher, englishDataset, englishRecommendedTransformers, parseRawPattern } = require('obscenity');
const db = require('./db');

// Cache to hold compiled matchers per guild to optimize performance
const matcherCache = new Map();

/**
 * Retrieves the cached matcher or compiles a new one if the custom blocked words list changes.
 * @param {string} guildId
 * @param {string[]} blockedWords
 * @returns {object} { matcher, dataset }
 */
function getMatcher(guildId, blockedWords) {
  // Sort array to ensure key is consistent regardless of insertion order
  const sortedWords = [...blockedWords].sort();
  const cacheKey = `${guildId}-${sortedWords.join(',')}`;

  if (matcherCache.has(cacheKey)) {
    return matcherCache.get(cacheKey);
  }

  const dataset = new DataSet().addAll(englishDataset);
  for (const word of blockedWords) {
    try {
      const trimmed = word.trim().toLowerCase();
      if (trimmed) {
        dataset.addPhrase(builder =>
          builder.setMetadata({ originalWord: trimmed }).addPattern(parseRawPattern(trimmed))
        );
      }
    } catch (err) {
      console.error(`Failed to parse custom blocked word "${word}":`, err.message);
    }
  }

  const matcher = new RegExpMatcher({
    ...dataset.build(),
    ...englishRecommendedTransformers,
  });

  const entry = { matcher, dataset };
  matcherCache.set(cacheKey, entry);
  return entry;
}

/**
 * Checks a string against the default obscenity list and custom blocklist, filtering out allowlisted words.
 * @param {string} guildId
 * @param {string} content
 * @param {string[]} blockedWords
 * @param {string[]} allowedWords
 * @returns {string[]} Matched profanity words that are NOT allowlisted
 */
function checkObscenityMatches(guildId, content, blockedWords, allowedWords) {
  if (!content) return [];

  const { matcher, dataset } = getMatcher(guildId, blockedWords);
  const matches = matcher.getAllMatches(content, true);
  const activeInfractions = [];
  const normalizedAllowed = allowedWords.map(w => w.trim().toLowerCase());

  for (const match of matches) {
    const payload = dataset.getPayloadWithPhraseMetadata(match);
    const originalWord = payload.phraseMetadata?.originalWord?.toLowerCase() || '';

    // If the matched word is in the allowlist, skip it
    if (originalWord && normalizedAllowed.includes(originalWord)) {
      continue;
    }

    activeInfractions.push(originalWord || content.slice(match.startIndex, match.endIndex + 1));
  }

  return activeInfractions;
}

/**
 * Checks a message against custom regex filters.
 * @param {Message} message
 * @param {object} automodSettings
 * @returns {object|null} Match details or null
 */
function checkRegexFilters(message, automodSettings) {
  const filters = automodSettings.filters || [];
  for (const filter of filters) {
    try {
      const regex = new RegExp(filter.regex, 'i');
      if (regex.test(message.content)) {
        return { type: 'regex', rule: filter.regex, action: filter.action };
      }
    } catch (e) {
      // Ignore invalid regex patterns
    }
  }
  return null;
}

/**
 * Heuristics-based toxicity/spam score generator (0-100).
 * Checks caps lock, repeated characters, repeated words, and link/mention spam.
 * @param {Message} message
 * @returns {number} Score (0-100)
 */
function calculateToxicityScore(message) {
  const content = message.content;
  if (!content || content.length < 5) return 0;

  let score = 0;

  // 1. Caps lock spam (minimum 8 letters)
  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (letters.length >= 8) {
    const caps = letters.replace(/[^A-Z]/g, '');
    const ratio = caps.length / letters.length;
    if (ratio > 0.65) {
      score += ratio * 40; // up to 40 points
    }
  }

  // 2. Repeated characters spam (consecutive identical chars 4+ times, e.g. "aaaaa", "!!!!!")
  const repeatedCharRegex = /(.)\1{3,}/g;
  const repeats = content.match(repeatedCharRegex);
  if (repeats) {
    score += Math.min(repeats.length * 15, 30); // up to 30 points
  }

  // 3. Link or mention spam
  const linkMatches = content.match(/https?:\/\/[^\s]+/gi) || [];
  const mentionMatches = content.match(/<@!?\d+>/g) || [];
  if (linkMatches.length > 3 || mentionMatches.length > 4) {
    score += 25;
  }

  // 4. Repeated words spam
  const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const wordCounts = {};
  let duplicateWeight = 0;
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
    if (wordCounts[word] > 2) {
      duplicateWeight += 10;
    }
  }
  score += Math.min(duplicateWeight, 30); // up to 30 points

  return Math.min(Math.round(score), 100);
}

/**
 * Evaluates message and takes automated moderation action if needed.
 * @param {Message} message
 * @returns {Promise<boolean>} True if the message was deleted/moderated, false otherwise
 */
async function handleAutoMod(message) {
  const { guild, author, member } = message;
  if (!guild || author.bot) return false;

  // Skip admins/moderators to prevent lockouts
  if (member && member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return false;
  }

  const settings = db.getGuild(guild.id);
  const automod = settings.autoMod;
  if (!automod || !automod.enabled) return false;

  let infraction = null;

  // ── 1. Regex check ─────────────────────────────────────────────────────────
  const regexMatch = checkRegexFilters(message, automod);
  if (regexMatch) {
    infraction = {
      reason: `Matches custom regex filter: \`${regexMatch.rule}\``,
      action: regexMatch.action
    };
  }

  // ── 2. Obscenity/Toxicity check ───────────────────────────────────────────
  if (!infraction) {
    const blockedWords = automod.blockedWords || [];
    const allowedWords = automod.allowedWords || [];
    const profanities = checkObscenityMatches(guild.id, message.content, blockedWords, allowedWords);
    if (profanities.length > 0) {
      infraction = {
        reason: `Contains blocked word(s): ${profanities.join(', ')}`,
        action: 'delete'
      };
    }
  }

  // ── 3. Toxicity/Spam Heuristic check ───────────────────────────────────────
  if (!infraction) {
    const toxicityScore = calculateToxicityScore(message);
    if (toxicityScore >= automod.spamThreshold) {
      infraction = {
        reason: `Exceeded toxicity/spam threshold (Score: ${toxicityScore}%)`,
        action: 'delete' // Default action for spam heuristics is deletion
      };
    }
  }

  if (!infraction) return false;

  // ── 4. Take Action ─────────────────────────────────────────────────────────
  const action = infraction.action;
  const reason = infraction.reason;
  let wasDeleted = false;

  // Try to delete the message
  if (action === 'delete' || action === 'warn' || action === 'timeout') {
    try {
      await message.delete();
      wasDeleted = true;
    } catch (err) {
      console.error('AutoMod failed to delete message:', err.message);
    }
  }

  // Send channel warning
  if (action === 'warn') {
    try {
      const warnMsg = await message.channel.send({
        content: `⚠️ ${author}, your message was removed. Reason: **${reason}**.`
      });
      // Delete warning message after 8 seconds
      setTimeout(() => warnMsg.delete().catch(() => {}), 8000);
    } catch (err) {
      console.error('AutoMod failed to send warning:', err.message);
    }
  }

  // Timeout the member (10 minutes)
  if (action === 'timeout') {
    if (member && member.moderatable) {
      try {
        await member.timeout(10 * 60 * 1000, `AutoMod: ${reason}`);
        await message.channel.send({
          content: `🚫 ${author.tag} has been timed out for 10 minutes. Reason: **${reason}**.`
        });
      } catch (err) {
        console.error('AutoMod failed to timeout member:', err.message);
      }
    }
  }

  // ── 5. Log Infraction ──────────────────────────────────────────────────────
  if (settings.logChannelId) {
    const logChannel = guild.channels.cache.get(settings.logChannelId);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('🛡️ AutoMod Infraction Caught')
        .setColor(0xE74C3C)
        .addFields(
          { name: 'User', value: `${author.tag} (${author.id})`, inline: true },
          { name: 'Channel', value: `${message.channel}`, inline: true },
          { name: 'Action Taken', value: `**${action.toUpperCase()}**`, inline: true },
          { name: 'Reason', value: reason },
          { name: 'Original Content', value: message.content ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` : '*Empty message*' }
        )
        .setTimestamp();

      try {
        await logChannel.send({ embeds: [logEmbed] });
      } catch (err) {
        console.error('AutoMod failed to send embed to log channel:', err.message);
      }
    }
  }

  return wasDeleted;
}

module.exports = {
  calculateToxicityScore,
  handleAutoMod,
  checkObscenityMatches
};
