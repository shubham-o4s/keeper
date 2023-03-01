"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IORedisPool = exports.IORedisPoolOptions = exports.IORedisConnectionOptions = void 0;
const events_1 = require("events");
const generic_pool_1 = require("generic-pool");
const ioredis_1 = require("ioredis");
class IORedisConnectionOptions {
    constructor() {
        this.meh = {};
    }
}
exports.IORedisConnectionOptions = IORedisConnectionOptions;
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
    getConnection(priority) {
        return this.pool.acquire(priority);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9wb29sLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUFxQztBQUNyQywrQ0FBaUU7QUFDakUscUNBQThEO0FBRTlELE1BQWEsd0JBQXdCO0lBQXJDO1FBQ0UsUUFBRyxHQUFZLEVBQUUsQ0FBQTtJQUNuQixDQUFDO0NBQUE7QUFGRCw0REFFQztBQUVELE1BQWEsa0JBQWtCO0lBT3RCLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBVztRQUMvQixNQUFNLFFBQVEsR0FBRyxJQUFJLGtCQUFrQixFQUFFLENBQUE7UUFDekMsUUFBUSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUE7UUFDbEIsUUFBUSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUE7UUFDekIsUUFBUSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUE7UUFFekIsT0FBTyxRQUFRLENBQUE7SUFDakIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBWSxFQUFFLElBQVk7UUFDdEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxrQkFBa0IsRUFBRSxDQUFBO1FBQ3pDLFFBQVEsQ0FBQyxHQUFHLEdBQUcsU0FBUyxDQUFBO1FBQ3hCLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFBO1FBQ3BCLFFBQVEsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFBO1FBRXBCLE9BQU8sUUFBUSxDQUFBO0lBQ2pCLENBQUM7SUFFRDtRQXZCQSxTQUFJLEdBQXVCLFdBQVcsQ0FBQTtRQUN0QyxTQUFJLEdBQXVCLElBQUksQ0FBQTtRQUMvQixpQkFBWSxHQUFpQixFQUFFLENBQUE7UUFDL0IsZ0JBQVcsR0FBWSxFQUFFLENBQUE7SUFvQlYsQ0FBQztJQUVoQixrQkFBa0IsQ0FBQyxPQUFxQjtRQUN0QyxJQUFJLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQTtRQUMzQixPQUFPLElBQUksQ0FBQTtJQUNiLENBQUM7SUFFRCxlQUFlLENBQUMs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