import { Redis } from "@upstash/redis";

// Works with the Upstash Redis integration added from the Vercel Marketplace.
// Vercel injects either KV_REST_API_URL/TOKEN (legacy naming, still used by
// the Upstash integration for compatibility) or UPSTASH_REDIS_REST_URL/TOKEN
// depending on how it was connected — support both.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const kv = new Redis({ url, token });
