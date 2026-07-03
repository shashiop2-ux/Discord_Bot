const { Events, MessageFlags } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // ── Handle Autocomplete Requests ─────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && typeof command.autocomplete === 'function') {
        try {
          await command.autocomplete(interaction);
        } catch (err) {
          console.error(`Error executing autocomplete for /${interaction.commandName}:`, err);
        }
      }
      return;
    }

    // ── Handle Chat Input Slash Commands ─────────────────────────────────────
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing /${interaction.commandName}:`, error);
      try {
        const replyPayload = { content: 'Something went wrong running that command.', flags: MessageFlags.Ephemeral };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(replyPayload);
        } else {
          await interaction.reply(replyPayload);
        }
      } catch (replyError) {
        console.error('Failed to send error response to interaction:', replyError.message);
      }
    }
  },
};
