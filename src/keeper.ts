import * as _Redis from "ioredis"
// import {Redis} from "ioredis"
import * as R from 'ramda'
import { IORedisPool, IORedisPoolOptions } from "./pool";

const nilOrEmpty = (
  obj: any
): obj is null | undefined | [] | {} | "" => R.anyPass([R.isNil, R.isEmpty])(obj)

const createPool = (url: string) => {
  const ioRedisPoolOpts = IORedisPoolOptions
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
    })
  return new IORedisPool(ioRedisPoolOpts)
}


const availablePools: Record<string, IORedisPool> = {};
export const getCachePool = async (uri: string): Promise<IORedisPool> => {
  if (availablePools[uri]) {
    // AppLoggers.info("cache --> found available connection for uri");
    return await availablePools[uri];
  }

  // AppLoggers.info("cache --> setting up new connection");
  const redisPool = createPool(uri);
  availablePools[uri] = redisPool;
  return redisPool;
};

export const Keeper = <T>(
  dat: {
    uri: string
    options: { parseJSON: boolean; expire: number, ignoreCache?: boolean }
  },
  cacheUri: string,
  keygen: (...args: any[]) => string,
  fn: (...args: any[]) => Promise<T>
): ((...args: any[]) => Promise<T>) =>
  async (...args) => {
    const cache = await getCachePool(cacheUri)
    const cacheKey = keygen(args)
    const cacheResult = await cache.get(cacheKey)
    const expireTime = dat.options.expire
    const ignoreCache = dat.options.ignoreCache

    if (ignoreCache || nilOrEmpty(cacheResult)) {
      const result = await onCacheMiss({ cache, cacheKey, fn, expireTime }, ...args)
      return result
    }

    if (dat.options.parseJSON) {
      return JSON.parse(cacheResult) as T
    }
    return (cacheResult as unknown) as T
  }

const onCacheMiss = async (
  { cache, cacheKey, fn, expireTime }: {cache: IORedisPool, cacheKey: string, fn: (...args: any[]) => Promise<any>, expireTime: number},
  ...args: any[]
) => {
  const result = await fn.apply(fn, args)
  // cache if result is neither nil nor empty
  if (!nilOrEmpty(result)) {
    expireTime ?
      cache.setex(cacheKey, expireTime, JSON.stringify(result)) :
      cache.set(cacheKey, JSON.stringify(result))
  }
  return result
}

