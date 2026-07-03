const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member, client) {
    const settings = db.getGuild(member.guild.id);
    if (!settings.logChannelId) return;

    const logChannel = member.guild.channels.cache.get(settings.logChannelId);
    if (!logChannel) return;

    const user = member.user;
    const embed = new EmbedBuilder()
      .setTitle('📥 Member Joined')
      .setColor(0x2ECC71) // Green
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Member', value: `${member} (${user.tag})`, inline: true },
        { name: 'User ID', value: `${user.id}`, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true }
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send join log:', err.message);
    }
  },
};
