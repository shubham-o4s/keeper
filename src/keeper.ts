import * as _Redis from "ioredis"
import * as R from 'ramda'


const nilOrEmpty = (
  obj: any
): obj is null | undefined | [] | {} | "" => R.anyPass([R.isNil, R.isEmpty])(obj)


export namespace Keeper {
  export const Keeper = <T>(
    dat: {
      uri: string
      options: { parseJSON: boolean; expire: number, ignoreCache?: boolean }
    },
    getCache: (...args: any[]) => _Redis.Redis,
    keygen: (...args: any[]) => string,
    fn: (...args: any[]) => Promise<T>
  ): ((...args: any[]) => Promise<T>) =>
    async (...args) => {
      const cache = getCache(dat.uri)
      const cacheKey = keygen(args)
      const cacheResult = await cache.get(cacheKey)
      const expireTime = dat.options.expire
      const ignoreCache = dat.options.ignoreCache

      if (ignoreCache || nilOrEmpty(cacheResult)) {
        return await onCacheMiss({ cache, cacheKey, fn, expireTime }, ...args)
      }

      if (dat.options.parseJSON) {
        return JSON.parse(cacheResult) as T
      }
      return (cacheResult as unknown) as T
    }

  const onCacheMiss = async (
    { cache, cacheKey, fn, expireTime },
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

}

