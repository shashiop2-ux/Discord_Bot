const { Events, EmbedBuilder, ChannelType, AuditLogEvent, PermissionsBitField } = require('discord.js');
const db = require('../utils/db');
const { fetchExecutor } = require('../utils/auditLogs');

/**
 * Returns a list of permission flag names that are set in a BitField.
 * @param {PermissionsBitField} bitfield
 * @returns {string[]}
 */
function getPermissionNames(bitfield) {
  return bitfield.toArray();
}

/**
 * Diffs old and new permission overwrites for a channel.
 * @param {Guild} guild
 * @param {Collection} oldOverwrites
 * @param {Collection} newOverwrites
 * @returns {string[]} List of human-readable changes
 */
function diffPermissionOverwrites(guild, oldOverwrites, newOverwrites) {
  const changes = [];

  // 1. Check for new or updated overwrites
  for (const [id, newOverwrite] of newOverwrites.entries()) {
    const oldOverwrite = oldOverwrites.get(id);

    // Resolve target role or member name
    const role = guild.roles.cache.get(id);
    const member = guild.members.cache.get(id);
    const targetLabel = role ? `Role @${role.name}` : member ? `Member ${member.user.tag}` : `ID ${id}`;

    if (!oldOverwrite) {
      // Overwrite added
      const allowed = getPermissionNames(newOverwrite.allow);
      const denied = getPermissionNames(newOverwrite.deny);
      let desc = `🔹 **Added overrides for ${targetLabel}**`;
      if (allowed.length) desc += `\n  *Allowed:* ${allowed.join(', ')}`;
      if (denied.length)  desc += `\n  *Denied:* ${denied.join(', ')}`;
      changes.push(desc);
    } else {
      // Overwrite updated - check if allow or deny bits changed
      const allowChanged = !newOverwrite.allow.equals(oldOverwrite.allow);
      const denyChanged = !newOverwrite.deny.equals(oldOverwrite.deny);

      if (allowChanged || denyChanged) {
        let desc = `📝 **Updated overrides for ${targetLabel}**`;
        if (allowChanged) {
          const oldAllowed = getPermissionNames(oldOverwrite.allow);
          const newAllowed = getPermissionNames(newOverwrite.allow);
          desc += `\n  *Allowed:* \`[${oldAllowed.join(', ')}]\` ➔ \`[${newAllowed.join(', ')}]\``;
        }
        if (denyChanged) {
          const oldDenied = getPermissionNames(oldOverwrite.deny);
          const newDenied = getPermissionNames(newOverwrite.deny);
          desc += `\n  *Denied:* \`[${oldDenied.join(', ')}]\` ➔ \`[${newDenied.join(', ')}]\``;
        }
        changes.push(desc);
      }
    }
  }

  // 2. Check for removed overwrites
  for (const [id, oldOverwrite] of oldOverwrites.entries()) {
    if (!newOverwrites.has(id)) {
      const role = guild.roles.cache.get(id);
      const member = guild.members.cache.get(id);
      const targetLabel = role ? `Role @${role.name}` : member ? `Member ${member.user.tag}` : `ID ${id}`;
      changes.push(`❌ **Removed overrides for ${targetLabel}**`);
    }
  }

  return changes;
}

module.exports = {
  name: Events.ChannelUpdate,
  async execute(oldChannel, newChannel, client) {
    const { guild } = newChannel;
    if (!guild) return;

    const settings = db.getGuild(guild.id);
    if (!settings.logChannelId) return;

    // Default channels logging enabled state is true
    const channelsLoggingEnabled = settings.logging?.channelsEnabled !== false;
    if (!channelsLoggingEnabled) return;

    const logChannel = guild.channels.cache.get(settings.logChannelId);
    if (!logChannel) return;

    const diffs = [];

    // ── 1. Detect Name Change ────────────────────────────────────────────────
    if (oldChannel.name !== newChannel.name) {
      diffs.push(`**Name:** \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
    }

    // ── 2. Detect Topic Change ───────────────────────────────────────────────
    if (oldChannel.topic !== newChannel.topic) {
      const oldTopic = oldChannel.topic ? `"${oldChannel.topic}"` : '*None*';
      const newTopic = newChannel.topic ? `"${newChannel.topic}"` : '*None*';
      diffs.push(`**Topic:** ${oldTopic} ➔ ${newTopic}`);
    }

    // ── 3. Detect Category parent change ─────────────────────────────────────
    if (oldChannel.parentId !== newChannel.parentId) {
      const oldParent = oldChannel.parent ? `📁 ${oldChannel.parent.name}` : '*None*';
      const newParent = newChannel.parent ? `📁 ${newChannel.parent.name}` : '*None*';
      diffs.push(`**Category Parent:** ${oldParent} ➔ ${newParent}`);
    }

    // ── 4. Detect Position Change ────────────────────────────────────────────
    if (oldChannel.position !== newChannel.position) {
      diffs.push(`**Position:** Position reordered (\`${oldChannel.position}\` ➔ \`${newChannel.position}\`)`);
    }

    // ── 5. Detect Slowmode Change ────────────────────────────────────────────
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      diffs.push(`**Slowmode:** \`${oldChannel.rateLimitPerUser}s\` ➔ \`${newChannel.rateLimitPerUser}s\``);
    }

    // ── 6. Detect NSFW Change ────────────────────────────────────────────────
    if (oldChannel.nsfw !== newChannel.nsfw) {
      diffs.push(`**NSFW Toggle:** \`${oldChannel.nsfw ? 'Enabled' : 'Disabled'}\` ➔ \`${newChannel.nsfw ? 'Enabled' : 'Disabled'}\``);
    }

    // ── 7. Voice Channel specific changes ────────────────────────────────────
    if (oldChannel.type === ChannelType.GuildVoice || oldChannel.type === ChannelType.GuildStageVoice) {
      if (oldChannel.bitrate !== newChannel.bitrate) {
        diffs.push(`**Bitrate:** \`${oldChannel.bitrate / 1000}kbps\` ➔ \`${newChannel.bitrate / 1000}kbps\``);
      }
      if (oldChannel.userLimit !== newChannel.userLimit) {
        const oldLimit = oldChannel.userLimit === 0 ? 'Unlimited' : oldChannel.userLimit;
        const newLimit = newChannel.userLimit === 0 ? 'Unlimited' : newChannel.userLimit;
        diffs.push(`**User Limit:** \`${oldLimit}\` ➔ \`${newLimit}\``);
      }
    }

    // ── 8. Permission Overwrite changes ──────────────────────────────────────
    const permChanges = diffPermissionOverwrites(
      guild,
      oldChannel.permissionOverwrites.cache,
      newChannel.permissionOverwrites.cache
    );

    // If no values changed, abort log
    if (diffs.length === 0 && permChanges.length === 0) return;

    // Fetch executor from audit log
    const editor = await fetchExecutor(guild, AuditLogEvent.ChannelUpdate, newChannel.id);

    const embed = new EmbedBuilder()
      .setTitle('📝 Channel Updated')
      .setColor(0xF1C40F) // Yellow
      .setDescription(`Channel: ${newChannel} (${newChannel.name})`)
      .setTimestamp();

    if (diffs.length > 0) {
      embed.addFields({
        name: 'Settings Changed',
        value: diffs.join('\n')
      });
    }

    if (permChanges.length > 0) {
      embed.addFields({
        name: 'Permissions Changed',
        value: permChanges.join('\n\n').slice(0, 1024)
      });
    }

    embed.addFields({
      name: 'Edited By',
      value: editor ? `${editor} (${editor.tag})` : '*Unknown (Audit Log missing)*'
    });

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send channel update log:', err.message);
    }
  },
};
