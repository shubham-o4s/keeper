"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IORedisPool = exports.createRedis = exports.IORedisPoolOptions = exports.IORedisConnectionOptions = void 0;
const events_1 = require("events");
const generic_pool_1 = require("generic-pool");
const ioredis_1 = require("ioredis");
class IORedisConnectionOptions {
    constructor() {
        this.meh = {};
    }
}
exports.IORedisConnectionOptions = IORedisConnectionOptions;
/**
 * This is a an extension of keeper library.
 * This wraps ioredis giving pooling capability
 */
class IORedisPoolOptions {
    static fromUrl(url) {
        const instance = new IORedisPoolOptions();
        instance.url = url;
        instance.host = undefined;
        instance.port = undefined;
        return instance;
    }
    static fromHostAndPort(host, port) {
        const instance = new IORedisPoolOptions();
        instance.url = undefined;
        instance.host = host;
        instance.port = port;
        return instance;
    }
    constructor() {
        this.host = '127.0.0.1';
        this.port = 6379;
        this.redisOptions = {};
        this.poolOptions = {};
    }
    withIORedisOptions(options) {
        this.redisOptions = options;
        return this;
    }
    withPoolOptions(poolOptions) {
        this.poolOptions = poolOptions;
        return this;
    }
}
exports.IORedisPoolOptions = IORedisPoolOptions;
const createRedis = (opts) => {
    if (opts.url) {
        return new ioredis_1.default(opts.url, opts.redisOptions);
    }
    else {
        return new ioredis_1.default(opts.port || 6379, opts.host || '127.0.0.1', opts.redisOptions);
    }
};
exports.createRedis = createRedis;
class IORedisPool extends events_1.EventEmitter {
    constructor(opts) {
        super();
        this.opts = opts;
        this.pool = {};
        this.pool = this.buildPool();
    }
    buildPool() {
        const factory = {
            create: () => {
                const context = this;
                return new Promise((resolve, reject) => {
                    let client;
                    if (context.opts.url) {
                        client = new ioredis_1.default(context.opts.url, context.opts.redisOptions);
                    }
                    else {
                        client = new ioredis_1.default(context.opts.port || 6379, context.opts.host || '127.0.0.1', context.opts.redisOptions);
                    }
                    client
                        .on('error', (e) => {
                        context.emit('error', e, client);
                        reject();
                    })
                        .on('connect', () => {
                        context.emit('connect', client);
                    })
                        .on('ready', () => {
                        context.emit('ready', client);
                        resolve(client);
                    })
                        .on('reconnecting', () => {
                        context.emit('reconnecting', client);
                    });
                });
            },
            destroy: (client) => {
                const context = this;
                return new Promise((resolve) => {
                    client
                        .on('close', (e) => {
                        context.emit('close', e, client);
                    })
                        .on('end', () => {
                        context.emit('disconnected', client);
                        resolve();
                    })
                        .disconnect();
                });
            },
            validate: (client) => {
                return new Promise((resolve) => {
                    if (client.status === "connecting" ||
                        client.status === "connect" ||
                        client.status === "ready") {
                        resolve(true);
                    }
                    else {
                        resolve(false);
                    }
                });
            }
        };
        return (0, generic_pool_1.createPool)(factory, this.opts.poolOptions);
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
        };
    }
    /**
     * Use only if you know what you're doing.
     * DONT FORGET TO RELEASE CONNECTION RIGHT AFTER
     * @param priority
     * @returns
     */
    getConnection(priority) {
        return this.pool.acquire(priority);
    }
    async del(keys) {
        const cache = await this.getConnection();
        const res = await cache.del(keys);
        this.pool.release(cache);
        return res;
    }
    async set(key, value, keepttl = false) {
        const cache = await this.getConnection();
        let res;
        if (keepttl) {
            // res = await cache.set(key, value, "KEEPTTL") TODO: this is available only from version 6
            const ttl = await cache.ttl(key);
            res = await cache.setex(key, ttl, value);
        }
        else {
            res = await cache.set(key, value);
        }
        this.pool.release(cache);
        return res;
    }
    async setWithSeconds(key, value, secondsToken, seconds) {
        const cache = await this.getConnection();
        const res = await cache.set(key, value, secondsToken, seconds);
        this.pool.release(cache);
        return res;
    }
    async setex(key, ttl, value) {
        const cache = await this.getConnection();
        const res = await cache.setex(key, ttl, value);
        this.pool.release(cache);
        return res;
    }
    async get(key) {
        const cache = await this.getConnection();
        const res = await cache.get(key);
        this.pool.release(cache);
        return res;
    }
    async mget(keys) {
        const cache = await this.getConnection();
        const res = await cache.mget(keys);
        this.pool.release(cache);
        return res;
    }
    async exists(keys) {
        const cache = await this.getConnection();
        const res = await cache.exists(keys);
        this.pool.release(cache);
        return res;
    }
    /**
     * commands can be [["set", "testMulti", "5"], ["get", "testMulti"], ["incr", "testMulti"], ["decr", "testMulti"]]
     * TODO: instead of using plain array of string, expose a function just like redis.multi
     * so that a chainable object is returned and type definable
     *
     * @param commands string[][]
     * @returns
     */
    async execCommands(commands) {
        const cache = await this.getConnection();
        const res = await cache.pipeline(commands).exec();
        this.pool.release(cache);
        return res;
    }
    release(client) {
        return this.pool.release(client);
    }
    disconnect(client) {
        return this.pool.destroy(client);
    }
    async end() {
        await this.pool.drain();
        const res = await this.pool.clear();
        this.emit('end');
        return res;
    }
    async execute(fn, priority) {
        const client = await this.pool.acquire(priority);
        const result = await fn(client);
        await this.release(client);
        return result;
    }
}
exports.IORedisPool = IORedisPool;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9wb29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFxQztBQUNyQywrQ0FBaUU7QUFDakUscUNBQXdGO0FBRXhGLE1BQWEsd0JBQXdCO0lBQXJDO1FBQ0UsUUFBRyxHQUFZLEVBQUUsQ0FBQTtJQUNuQixDQUFDO0NBQUE7QUFGRCw0REFFQztBQUVEOzs7R0FHRztBQUNILE1BQWEsa0JBQWtCO0lBT3RCLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBVztRQUMvQixNQUFNLFFBQVEsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUE7UUFDekMsUUFBUSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUE7UUFDbEIsUUFBUSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUE7UUFDekIsUUFBUSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUE7UUFFekIsT0FBTyxRQUFRLENBQUE7SUFDakIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBWSxFQUFFLElBQVk7UUFDdEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFBO1FBQ3pDLFFBQVEsQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFBO1FBQ3hCLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFBO1FBQ3BCLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFBO1FBRXBCLE9BQU8sUUFBUSxDQUFBO0lBQ2pCLENBQUM7SUFFRDtRQXZCQSxTQUFJLEdBQXVCLFdBQVcsQ0FBQTtRQUN0QyxTQUFJLEdBQXVCLElBQUksQ0FBQTtRQUMvQixpQkFBWSxHQUFpQixFQUFFLENBQUE7UUFDL0IsZ0JBQVcsR0FBWSxFQUFFLENBQUE7SUFvQlYsQ0FBQztJQUVoQixrQkFBa0IsQ0FBQyxPQUFxQjtRQUN0QyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQTtRQUMzQixPQUFPLElBQUksQ0FBQTtJQUNiLENBQUM7SUFF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