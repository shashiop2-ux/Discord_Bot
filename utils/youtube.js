const { YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID } = process.env;

// In-memory cache for live check results to avoid exceeding daily YouTube API quotas
const cache = {
  isLive: false,
  url: `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID || ''}`,
  lastCheck: 0
};

const CACHE_DURATION_MS = 90 * 1000; // 90 seconds cache

/**
 * Checks if the configured YouTube channel is currently live streaming.
 * Uses a memory cache to respect YouTube API limits.
 * Falls back gracefully to offline state in case of errors/quota limits.
 * @returns {Promise<{isLive: boolean, url: string}>}
 */
async function checkLiveStatus() {
  const now = Date.now();

  // If cache is still valid, return cached results
  if (now - cache.lastCheck < CACHE_DURATION_MS && cache.url) {
    return { isLive: cache.isLive, url: cache.url };
  }

  // Fallback if credentials are not configured
  if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID) {
    console.warn('⚠️ YouTube API credentials or channel ID are not configured in your .env file.');
    return { isLive: false, url: `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID || ''}` };
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&eventType=live&type=video&key=${YOUTUBE_API_KEY}`;
    
    console.log(`📡 Querying YouTube Data API for live status of channel ${YOUTUBE_CHANNEL_ID}...`);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const isLive = data.items && data.items.length > 0;
    let url = `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}`;

    if (isLive) {
      const videoId = data.items[0].id.videoId;
      url = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`🔴 YouTube Channel is LIVE! Video URL: ${url}`);
    } else {
      console.log('😴 YouTube Channel is currently offline.');
    }

    // Update Cache
    cache.isLive = isLive;
    cache.url = url;
    cache.lastCheck = now;

    return { isLive, url };
  } catch (error) {
    console.error('❌ Failed to fetch live status from YouTube API:', error.message);
    
    // Graceful fallback to offline channel link on network error or quota limits
    return { 
      isLive: false, 
      url: `https://www.youtube.com/channel/${YOUTUBE_CHANNEL_ID}` 
    };
  }
}

module.exports = {
  checkLiveStatus
};
