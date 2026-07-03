const { Events } = require('discord.js');
const { GREET_USERNAME } = process.env;
const karma = require('../utils/karma');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(readyClient, client) {
    console.log(`Logged in as ${readyClient.user.tag}`);

    // Initialize the meme voting scanner
    karma.initMemeScanner(readyClient);

    // DM greeting to GREET_USERNAME if set
    if (!GREET_USERNAME) return;

    for (const guild of readyClient.guilds.cache.values()) {
      try {
        const matched = await guild.members.fetch({ query: GREET_USERNAME, limit: 1 });
        const target = matched.first();

        if (target && target.user.username.toLowerCase() === GREET_USERNAME.toLowerCase()) {
          await target.send('hi 👋');
          console.log(`Sent "hi" to ${target.user.tag} in ${guild.name}`);
          return; // stop after the first successful send
        }
      } catch (err) {
        console.error(`Could not search/DM in guild "${guild.name}":`, err.message);
      }
    }

    console.log(`Could not find a member named "${GREET_USERNAME}" in any connected server.`);
  },
};
