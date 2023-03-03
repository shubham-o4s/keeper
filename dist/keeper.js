"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Keeper = exports.getCachePool = void 0;
// import {Redis} from "ioredis"
const R = require("ramda");
const pool_1 = require("./pool");
const nilOrEmpty = (obj) => R.anyPass([R.isNil, R.isEmpty])(obj);
const createPool = (url) => {
    const ioRedisPoolOpts = pool_1.IORedisPoolOptions
        .fromUrl(url)
        // This accepts the RedisOptions class from ioredis as an argument
        // https://github.com/luin/ioredis/blob/master/lib/redis/RedisOptions.ts
        .withIORedisOptions({
        retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
    })
        // This accepts the Options class from @types/generic-pool as an argument
        // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/generic-pool/index.d.ts#L36
        .withPoolOptions({
        min: Number(process.env.KEEPER_POOL_MIN) || 2,
        max: Number(process.env.KEEPER_POOL_MAX) || 10,
        acquireTimeoutMillis: Number(process.env.KEEPER_ACQUIRE_TIMEOUT) || 1000,
        maxWaitingClients: Number(process.env.KEEPER_MAX_WAITING) || 300
    });
    return new pool_1.IORedisPool(ioRedisPoolOpts);
};
const availablePools = {};
const getCachePool = async (uri) => {
    if (availablePools[uri]) {
        // AppLoggers.info("cache --> found available connection for uri");
        return await availablePools[uri];
    }
    // AppLoggers.info("cache --> setting up new connection");
    const redisPool = createPool(uri);
    availablePools[uri] = redisPool;
    return redisPool;
};
exports.getCachePool = getCachePool;
const Keeper = (dat, cacheUri, keygen, fn) => async (...args) => {
    const cache = await (0, exports.getCachePool)(cacheUri);
    const cacheKey = keygen(args);
    const cacheResult = await cache.get(cacheKey);
    const expireTime = dat.options.expire;
    const ignoreCache = dat.options.ignoreCache;
    if (ignoreCache || nilOrEmpty(cacheResult)) {
        const result = await onCacheMiss({ cache, cacheKey, fn, expireTime }, ...args);
        return result;
    }
    if (dat.options.parseJSON) {
        return JSON.parse(cacheResult);
    }
    return cacheResult;
};
exports.Keeper = Keeper;
const onCacheMiss = async ({ cache, cacheKey, fn, expireTime }, ...args) => {
    const result = await fn.apply(fn, args);
    // cache if result is neither nil nor empty
    if (!nilOrEmpty(result)) {
        expireTime ?
            cache.setex(cacheKey, expireTime, JSON.stringify(result)) :
            cache.set(cacheKey, JSON.stringify(result));
    }
    return result;
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoia2VlcGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL2tlZXBlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxnQ0FBZ0M7QUFDaEMsMkJBQTBCO0FBQzFCLGlDQUF5RDtBQUV6RCxNQUFNLFVBQVUsR0FBRyxDQUNqQixHQUFRLEVBQ2dDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQTtBQUVqRixNQUFNLFVBQVUsR0FBRyxDQUFDLEdBQVcsRUFBRSxFQUFFO0lBQ2pDLE1BQU0sZUFBZSxHQUFHLHlCQUFrQjtTQUN2QyxPQUFPLENBQUMsR0FBRyxDQUFDO1FBQ2Isa0VBQWtFO1FBQ2xFLHdFQUF3RTtTQUN2RSxrQkFBa0IsQ0FBQztRQUNsQixhQUFhLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUN2QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssR0FBRyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekMsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0tBRUYsQ0FBQztRQUNGLHlFQUF5RTtRQUN6RSxtR0FBbUc7U0FDbEcsZUFBZSxDQUFDO1FBQ2YsR0FBRyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUM7UUFDN0MsR0FBRyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUU7UUFDOUMsb0JBQW9CLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsSUFBSSxJQUFJO1FBQ3hFLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixDQUFDLElBQUksR0FBRztLQUNqRSxDQUFDLENBQUE7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