import { EventEmitter } from 'events'
import { createPool, Factory, Pool, Options } from 'generic-pool'
import Redis, { Redis as IRedis, RedisOptions, Pipeline, RedisCommander } from 'ioredis'

export class IORedisConnectionOptions {
  meh: Options = {}
}

/**
 * This is a an extension of keeper library. 
 * This wraps ioredis giving pooling capability
 */
export class IORedisPoolOptions {
  url?: string
  host: string | undefined = '127.0.0.1'
  port: number | undefined = 6379
  redisOptions: RedisOptions = {}
  poolOptions: Options = {}

  public static fromUrl(url: string): IORedisPoolOptions {
    const instance = new IORedisPoolOptions()
    instance.url = url
    instance.host = undefined
    instance.port = undefined

    return instance
  }

  public static fromHostAndPort(host: string, port: number): IORedisPoolOptions {
    const instance = new IORedisPoolOptions()
    instance.url = undefined
    instance.host = host
    instance.port = port

    return instance
  }

  constructor() {}

  withIORedisOptions(options: RedisOptions): IORedisPoolOptions {
    this.redisOptions = options
    return this
  }

  withPoolOptions(poolOptions: Options): IORedisPoolOptions {
    this.poolOptions = poolOptions
    return this
  }
}

export const createRedis = (opts: IORedisPoolOptions) => {
  if (opts.url) {
    return new Redis(opts.url, opts.redisOptions)
  } else {
    return new Redis(opts.port || 6379, opts.host || '127.0.0.1', opts.redisOptions)
  }
}

export class IORedisPool extends EventEmitter {
  private pool: Pool<IRedis> = {} as Pool<IRedis>

  constructor(private opts: IORedisPoolOptions) {
    super()
    this.pool = this.buildPool()
  }

  private buildPool(): Pool<IRedis> {
    const factory: Factory<IRedis> = {
      create: (): Promise<IRedis> => {
        const context = this
        return new Promise((resolve, reject) => {
          let client: IRedis
          if (context.opts.url) {
            client = new Redis(context.opts.url, context.opts.redisOptions)
          } else {
            client = new Redis(context.opts.port || 6379, context.opts.host || '127.0.0.1', context.opts.redisOptions)
          }

          client
            .on('error', (e: Error) => {
              context.emit('error', e, client)
              reject()
            })
            .on('connect', () => {
              context.emit('connect', client)
            })
            .on('ready', () => {
              context.emit('ready', client)
              resolve(client)
            })
            .on('reconnecting', () => {
              context.emit('reconnecting', client)
            })
        })
      },
      destroy: (client: IRedis): Promise<void> => {
        const context = this
        return new Promise((resolve) => {
          client
            .on('close', (e: Error) => {
              context.emit('close', e, client)
            })
            .on('end', () => {
              context.emit('disconnected', client)
              resolve()
            })
            .disconnect()
        })
      },
      validate: (client: IRedis): Promise<boolean> => {
        return new Promise((resolve) => {
          if (
            client.status === "connecting" ||
            client.status === "connect" ||
            client.status === "ready"
          ) {
            resolve(true)
          }
          else {
            resolve(false)
          }
        })
      }
    }

    return createPool(factory, this.opts.poolOptions)
  }

  getInfo() {
    return {
      spareResourceCapacity: this.pool.spareResourceCapacity,
      size: this.pool.size,
      available: this.pool.available,
      borrowed: this.pool.borrowed,
      pending: this.pool.pending,
      max: this.pool.max,
      min: this.pool.min
    }
  }

  getConnection(priority?: number) {
    return this.pool.acquire(priority)
  }

  async del(keys: string[]) {
    const cache = await this.getConnection()
    const res = await cache.del(keys)
    this.pool.release(cache)
    return res
  }

  async set(key: string, value: string | number | Buffer) {
    const cache = await this.getConnection()
    const res = await cache.set(key, value)
    this.pool.release(cache)
    return res
  }

  async setWithSeconds(key: string, value: string | number | Buffer, secondsToken: "EX", seconds: number | string) {
    const cache = await this.getConnection()
    const res = await cache.set(key, value, secondsToken, seconds)
    this.pool.release(cache)
    return res
  }

  async setex(key: string, ttl: number, value: number | string | Buffer) {
    const cache = await this.getConnection()
    const res = await cache.setex(key, ttl, value)
    this.pool.release(cache)
    return res
  }

  async get(key: string) {
    const cache = await this.getConnection()
    const res = await cache.get(key)
    this.pool.release(cache)
    return res
  }

  async mget(keys: string[]) {
    const cache = await this.getConnection()
    const res = await cache.mget(keys)
    this.pool.release(cache)
    return res
  }

  async exists(keys: string[]) {
    const cache = await this.getConnection()
    const res = await cache.exists(keys)
    this.pool.release(cache)
    return res
  }

  /**
   * commands can be [["set", "testMulti", "5"], ["get", "testMulti"], ["incr", "testMulti"], ["decr", "testMulti"]]
   * TODO: instead of using plain array of string, expose a function just like redis.multi 
   * so that a chainable object is returned and type definable
   * 
   * @param commands string[][]
   * @returns 
   */
  async execCommands(commands: (number | string)[][]) {
    const cache = await this.getConnection()
    const res = await cache.pipeline(commands).exec()
    this.pool.release(cache)
    return res
  }

  release(client: IRedis) {
    return this.pool.release(client)
  }

  disconnect(client: IRedis) {
    return this.pool.destroy(client)
  }

  async end() {
    await this.pool.drain()
    const res = await this.pool.clear()
    this.emit('end')
    return res
  }

  async execute<T>(fn: (client: IRedis) => Promise<T>, priority?: number) {
      const client = await this.pool.acquire(priority)
      const result = await fn(client)
      await this.release(client)
      return result
  }
}
