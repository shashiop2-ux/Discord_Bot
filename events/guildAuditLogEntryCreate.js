const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.GuildAuditLogEntryCreate,
  async execute(auditLogEntry, guild, client) {
    const settings = db.getGuild(guild.id);
    if (!settings.logChannelId) return;

    const logChannel = guild.channels.cache.get(settings.logChannelId);
    if (!logChannel) return;

    const { action, executorId, targetId, reason, changes } = auditLogEntry;
    const executor = client.users.cache.get(executorId) || `<@${executorId}>`;
    const target = client.users.cache.get(targetId) || `<@${targetId}>`;

    let title = '🛡️ Server Audit Log Action';
    let color = 0x7F8C8D; // Grey
    let description = '';

    // ── Member Ban Added ─────────────────────────────────────────────────────
    if (action === AuditLogEvent.MemberBanAdd) {
      title = '🔨 Member Banned';
      color = 0xC0392B; // Dark Red
      description = `**Target:** ${target} (${targetId})\n**Moderator:** ${executor}\n**Reason:** ${reason || 'No reason provided.'}`;
    }
    // ── Member Ban Removed ───────────────────────────────────────────────────
    else if (action === AuditLogEvent.MemberBanRemove) {
      title = '🔓 Member Unbanned';
      color = 0x2ECC71; // Green
      description = `**Target:** ${target} (${targetId})\n**Moderator:** ${executor}\n**Reason:** ${reason || 'No reason provided.'}`;
    }
    // ── Member Kicked ────────────────────────────────────────────────────────
    else if (action === AuditLogEvent.MemberKick) {
      title = '👞 Member Kicked';
      color = 0xD35400; // Orange-Red
      description = `**Target:** ${target} (${targetId})\n**Moderator:** ${executor}\n**Reason:** ${reason || 'No reason provided.'}`;
    }
    // ── Member Timeout / Update ──────────────────────────────────────────────
    else if (action === AuditLogEvent.MemberUpdate && changes) {
      const timeoutChange = changes.find(c => c.key === 'communication_disabled_until');
      if (timeoutChange) {
        const untilVal = timeoutChange.new;
        if (untilVal) {
          title = '🔇 Member Timed Out';
          color = 0xE67E22; // Orange
          const targetTime = Math.floor(new Date(untilVal).getTime() / 1000);
          description = `**Target:** ${target} (${targetId})\n**Moderator:** ${executor}\n**Duration:** Until <t:${targetTime}:f> (<t:${targetTime}:R>)\n**Reason:** ${reason || 'No reason provided.'}`;
        } else {
          title = '🔊 Member Timeout Removed';
          color = 0x2ECC71; // Green
          description = `**Target:** ${target} (${targetId})\n**Moderator:** ${executor}\n**Reason:** ${reason || 'No reason provided.'}`;
        }
      }
    }
    // ── Role Created ─────────────────────────────────────────────────────────
    else if (action === AuditLogEvent.RoleCreate) {
      title = '➕ Role Created';
      color = 0x27AE60; // Green
      description = `**Target Role ID:** \`${targetId}\`\n**Moderator:** ${executor}`;
    }
    // ── Role Deleted ─────────────────────────────────────────────────────────
    else if (action === AuditLogEvent.RoleDelete) {
      title = '➖ Role Deleted';
      color = 0xC0392B; // Red
      description = `**Target Role ID:** \`${targetId}\`\n**Moderator:** ${executor}`;
    }

    // Skip if action isn't handled by one of our custom logs
    if (!description) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send audit log entry:', err.message);
    }
  },
};
