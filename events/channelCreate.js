const { Events, EmbedBuilder, ChannelType, AuditLogEvent } = require('discord.js');
const db = require('../utils/db');
const { fetchExecutor } = require('../utils/auditLogs');

module.exports = {
  name: Events.ChannelCreate,
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
    const creator = await fetchExecutor(guild, AuditLogEvent.ChannelCreate, channel.id);

    let typeLabel = 'Text Channel';
    if (channel.type === ChannelType.GuildCategory) typeLabel = 'Category';
    else if (channel.type === ChannelType.GuildVoice) typeLabel = 'Voice Channel';
    else if (channel.type === ChannelType.GuildStageVoice) typeLabel = 'Stage Channel';
    else if (channel.type === ChannelType.GuildAnnouncement) typeLabel = 'Announcement Channel';

    const embed = new EmbedBuilder()
      .setTitle('➕ Channel Created')
      .setColor(0x2ECC71) // Green
      .addFields(
        { name: 'Name', value: channel.type === ChannelType.GuildCategory ? `📁 **${channel.name}**` : `${channel}`, inline: true },
        { name: 'Type', value: typeLabel, inline: true },
        { name: 'Parent Category', value: channel.parent ? `📁 ${channel.parent.name}` : '*None*', inline: true },
        { name: 'Created By', value: creator ? `${creator} (${creator.tag})` : '*Unknown (Audit Log missing)*', inline: true }
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send channel create log:', err.message);
    }
  },
};
