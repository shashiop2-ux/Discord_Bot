const { Events, EmbedBuilder } = require('discord.js');
const db = require('../utils/db');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member, client) {
    const settings = db.getGuild(member.guild.id);
    if (!settings.logChannelId) return;

    const logChannel = member.guild.channels.cache.get(settings.logChannelId);
    if (!logChannel) return;

    const user = member.user;
    const embed = new EmbedBuilder()
      .setTitle('📤 Member Left')
      .setColor(0xE67E22) // Orange
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Member', value: `${user} (${user.tag})`, inline: true },
        { name: 'User ID', value: `${user.id}`, inline: true },
        { name: 'Joined Server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown', inline: true },
        { name: 'Total Members', value: `${member.guild.memberCount}`, inline: true }
      )
      .setTimestamp();

    try {
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Failed to send leave log:', err.message);
    }
  },
};
