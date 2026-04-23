import { Redis } from '@upstash/redis';

// Lazy-load Redis client to ensure env vars are loaded first
let redisInstance: Redis | null = null;

export function isRedisConfigured(): boolean {
    return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedisClient(): Redis | null {
    if (!isRedisConfigured()) {
        return null;
    }

    if (!redisInstance) {
        redisInstance = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
    }
    return redisInstance;
}
