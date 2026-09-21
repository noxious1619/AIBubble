import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
});

export const REDIS_KEYS = {
  // Latest JSON payload (TTL: 86400s)
  HAZARD_CURRENT: 'hazard:current',
  
  // Sliding window counter (TTL: 60s)
  rateLimit: (ip: string) => `ratelimit:${ip}`,
  
  // Daily snapshot for history (TTL: 30d)
  hazardHistory: (date: string) => `hazard:history:${date}`,
  
  // Cached OG image PNG (TTL: 3600s)
  ogImage: (hash: string) => `og:image:${hash}`,
};
