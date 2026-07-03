const { PermissionsBitField } = require('discord.js');

/**
 * Fetches the user who triggered a specific event by querying the guild's audit logs.
 * Includes retry/polling logic because the audit log entry can lag behind the event.
 *
 * @param {Guild} guild - The guild where the event occurred
 * @param {number} actionType - The AuditLogEvent type (e.g. AuditLogEvent.ChannelCreate)
 * @param {string} targetId - The ID of the target channel/category/member
 * @param {number} [retries=4] - Number of retries to fetch
 * @param {number} [delay=1200] - Delay in ms between retries
 * @returns {Promise<User|null>} The executor User object or null if not found
 */
async function fetchExecutor(guild, actionType, targetId, retries = 4, delay = 1200) {
  // Guard: bot must have ViewAuditLog permission
  const botMember = guild.members.me;
  if (!botMember || !botMember.permissions.has(PermissionsBitField.Flags.ViewAuditLogs)) {
    return null;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const auditLogs = await guild.fetchAuditLogs({
        limit: 5,
        type: actionType
      });

      const entry = auditLogs.entries.find(e => e.targetId === targetId);

      if (entry) {
        // Verify the entry is recent (created within the last 15 seconds)
        // to prevent false matches with old actions on reuse of same channel IDs/positions.
        const createdAgo = Date.now() - entry.createdTimestamp;
        if (createdAgo < 15000) {
          return entry.executor;
        }
      }
    } catch (err) {
      console.error(`Error fetching audit logs (type: ${actionType}):`, err.message);
    }

    if (i < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return null;
}

module.exports = {
  fetchExecutor
};
