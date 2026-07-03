const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

let dbData = {
  guilds: {}
};

// Load database from file
function load() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const dataStr = fs.readFileSync(DB_FILE, 'utf8');
      dbData = JSON.parse(dataStr);
      // Ensure basic structure
      if (!dbData.guilds) dbData.guilds = {};
    } else {
      save();
    }
  } catch (err) {
    console.error('Error loading database file, initializing empty one:', err);
    save();
  }
}

let writePromise = Promise.resolve();

// Save database to file asynchronously (with a lock queue to prevent collisions)
function save() {
  writePromise = writePromise.then(async () => {
    try {
      const tempFile = `${DB_FILE}.tmp`;
      await fs.promises.writeFile(tempFile, JSON.stringify(dbData, null, 2), 'utf8');
      await fs.promises.rename(tempFile, DB_FILE);
    } catch (err) {
      console.error('Failed to save database file:', err);
    }
  });
  return writePromise;
}

// Initialize database on require
load();

module.exports = {
  /**
   * Get guild-specific settings. Initializes defaults if guild settings don't exist.
   * @param {string} guildId
   * @returns {object} Guild settings
   */
  getGuild(guildId) {
    if (!dbData.guilds[guildId]) {
      dbData.guilds[guildId] = {
        logChannelId: null,
        autoMod: {
          filters: [], // Array of { regex: string, action: 'delete' | 'warn' | 'timeout' | 'log' }
          spamThreshold: 75, // Threshold for heuristics (caps/link/repeated chars spam)
          enabled: false,
          blockedWords: [], // Custom phrases blocked beyond default library
          allowedWords: [] // Exempt/allowlisted words
        },
        autoResponders: [], // Array of { id: string, trigger: string, response: string, matchType: 'exact' | 'contains', useEmbed: boolean }
        karma: {
          channelId: null,
          upEmoji: '👍',
          downEmoji: '👎',
          hallOfFameChannelId: null,
          rewards: [] // Array of { threshold: number, roleId: string }
        },
        memes: {}, // Map of messageId -> { authorId: string, channelId: string, timestamp: number, processed: boolean }
        userKarma: {} // Map of userId -> { karma: number, totalPosts: number, bestMeme: { messageId: string, votes: number, url: string } }
      };
    } else {
      // Ensure properties exist for older database entries
      const automod = dbData.guilds[guildId].autoMod;
      if (automod) {
        if (!automod.blockedWords) automod.blockedWords = [];
        if (!automod.allowedWords) automod.allowedWords = [];
      }
      if (!dbData.guilds[guildId].autoResponders) {
        dbData.guilds[guildId].autoResponders = [];
      }
      if (!dbData.guilds[guildId].karma) {
        dbData.guilds[guildId].karma = {
          channelId: null,
          upEmoji: '👍',
          downEmoji: '👎',
          hallOfFameChannelId: null,
          rewards: [],
          strictMode: false
        };
      } else if (dbData.guilds[guildId].karma.strictMode === undefined) {
        dbData.guilds[guildId].karma.strictMode = false;
      }
      if (!dbData.guilds[guildId].memes) {
        dbData.guilds[guildId].memes = {};
      }
      if (!dbData.guilds[guildId].userKarma) {
        dbData.guilds[guildId].userKarma = {};
      }
    }

    // Pre-seed default YouTube stream responder if not already present in this guild
    const hasStream = dbData.guilds[guildId].autoResponders.some(
      r => r.response.trim() === '{youtube_live}'
    );
    if (!hasStream) {
      dbData.guilds[guildId].autoResponders.push({
        id: 'youtube-live-stream',
        trigger: 'stream',
        response: '{youtube_live}',
        matchType: 'contains',
        useEmbed: false
      });
      save(); // Commit the seed to db file
    }

    return dbData.guilds[guildId];
  },

  /**
   * Save guild settings.
   * @param {string} guildId
   * @param {object} settings
   */
  setGuild(guildId, settings) {
    dbData.guilds[guildId] = settings;
    save();
  },

  /**
   * Explicit save call if manual updates are performed on sub-objects.
   */
  save
};
