const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.MessageDelete,
  async execute(message, client) {
    // Ignore direct messages or bot messages
    if (!message.guild || message.author?.bot) return;

    const settings = db.getGuild(message.guild.id);
    if (!settings.logChannelId) return;

    const logChannel = message.guild.channels.cache.get(settings.logChannelId);
    if (!logChannel) return;

    const author = message.author;
    const authorTag = author ? author.tag : 'Unknown User';
    const authorId = author ? author.id : 'N/A';
    const avatarUrl = author ? author.displayAvatarURL() : null;

    const embed = new EmbedBuilder()
      .setTitle('🗑️ Message Deleted')
      .setColor(0xE74C3C) // Red
      .setAuthor({ name: authorTag, iconURL: avatarUrl })
      .addFields(
        { name: 'Channel', value: `${message.channel}`, inline: true },
        { name: 'Author', value: author ? `${author} (${authorId})` : 'Unknown', inline: true },
        { name: 'Content', value: message.content ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` : '*Empty message or content uncached*' }
      )
      .setTimestamp();

    // Check for attachments and list them
    if (message.attachments && message.attachments.size > 0) {
      const attachInfo = message.attachments.map(att => `📎 [${att.name}](${att.url})`).join('\n');
      embed.addFields({ name: 'Attachments', value: attachInfo });
    }

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send deletion log:', err.message);
    }
  },
};
