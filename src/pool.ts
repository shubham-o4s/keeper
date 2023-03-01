import { EventEmitter } from 'events'
import { createPool, Factory, Pool, Options } from 'generic-pool'
import Redis, { Redis as IRedis, RedisOptions } from 'ioredis'

export class IORedisConnectionOptions {
  meh: Options = {}
}

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

  getConnection(priority?: number) {
    return this.pool.acquire(priority)
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
