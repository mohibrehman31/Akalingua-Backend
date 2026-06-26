import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL as string, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

export default redis;
