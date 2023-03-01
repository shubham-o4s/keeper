import * as _Redis from "ioredis";
export declare const Keeper: <T>(dat: {
    uri: string;
    options: {
        parseJSON: boolean;
        expire: number;
        ignoreCache?: boolean;
    };
}, getCache: (...args: any[]) => _Redis.Redis, keygen: (...args: any[]) => string, fn: (...args: any[]) => Promise<T>) => (...args: any[]) => Promise<T>;
