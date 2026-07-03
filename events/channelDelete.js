const { Events, EmbedBuilder, ChannelType, AuditLogEvent } = require('discord.js');
const db = require('../utils/db');
const { fetchExecutor } = require('../utils/auditLogs');

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel, client) {
    const { guild } = channel;
    if (!guild) return;

    const settings = db.getGuild(guild.id);
    if (!settings.logChannelId) return;

    // Default channels logging enabled state is true
    const channelsLoggingEnabled = settings.logging?.channelsEnabled !== false;
    if (!channelsLoggingEnabled) return;

    const logChannel = guild.channels.cache.get(settings.logChannelId);
    if (!logChannel) return;

    // Fetch executor from audit log
    const deleter = await fetchExecutor(guild, AuditLogEvent.ChannelDelete, channel.id);

    let typeLabel = 'Text Channel';
    if (channel.type === ChannelType.GuildCategory) typeLabel = 'Category';
    else if (channel.type === ChannelType.GuildVoice) typeLabel = 'Voice Channel';
    else if (channel.type === ChannelType.GuildStageVoice) typeLabel = 'Stage Channel';
    else if (channel.type === ChannelType.GuildAnnouncement) typeLabel = 'Announcement Channel';

    const embed = new EmbedBuilder()
      .setTitle('➖ Channel Deleted')
      .setColor(0xE74C3C) // Red
      .addFields(
        { name: 'Name', value: channel.type === ChannelType.GuildCategory ? `📁 **${channel.name}**` : `#${channel.name}`, inline: true },
        { name: 'Type', value: typeLabel, inline: true },
        { name: 'Parent Category', value: channel.parent ? `📁 ${channel.parent.name}` : '*None*', inline: true },
        { name: 'Deleted By', value: deleter ? `${deleter} (${deleter.tag})` : '*Unknown (Audit Log missing)*', inline: true }
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send channel delete log:', err.message);
    }
  },
};
