const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage, client) {
    // Ignore direct messages or bot edits
    if (!oldMessage.guild || oldMessage.author?.bot) return;

    // Ignore if content hasn't changed (e.g. embed additions, pin changes)
    if (oldMessage.content === newMessage.content) return;

    const settings = db.getGuild(oldMessage.guild.id);
    if (!settings.logChannelId) return;

    const logChannel = oldMessage.guild.channels.cache.get(settings.logChannelId);
    if (!logChannel) return;

    const author = oldMessage.author || newMessage.author;
    const authorTag = author ? author.tag : 'Unknown User';
    const authorId = author ? author.id : 'N/A';
    const avatarUrl = author ? author.displayAvatarURL() : null;

    const embed = new EmbedBuilder()
      .setTitle('📝 Message Edited')
      .setColor(0xF1C40F) // Yellow
      .setAuthor({ name: authorTag, iconURL: avatarUrl })
      .addFields(
        { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
        { name: 'Author', value: `${author} (${authorId})`, inline: true },
        { name: 'Before', value: oldMessage.content ? `\`\`\`${oldMessage.content.slice(0, 1000)}\`\`\`` : '*Empty message*' },
        { name: 'After', value: newMessage.content ? `\`\`\`${newMessage.content.slice(0, 1000)}\`\`\`` : '*Empty message*' }
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send edit log:', err.message);
    }
  },
};
