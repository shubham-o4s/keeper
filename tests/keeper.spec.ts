import * as chai from "chai"
import * as sinon from "sinon"
import * as Pool from "../src/pool"
import { Keeper } from "../src/index"
import * as RedisMock from "ioredis-mock"
import * as events from "events"
const eventEmitter = new events.EventEmitter()
let counter = 0
const l1 = function listener() {
  counter++
}
eventEmitter.addListener("ping", l1)

const createRedisStub = sinon.stub(Pool, 'createRedis').callsFake(
  function () {
    return new RedisMock.default()
  })

const cacheUri = "redis://localhost:6379/12"

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const keygen = (a: number) => {
  switch (a[0]) {
    case 1:
      return "test-key-1"
    case 2:
      return "test-key-2"
    case 3:
      return "test-key-3"
    default:
      return "default-key"
  }
}

const fn = async (a: number) => {
  eventEmitter.emit("ping")
  if (a == 3) {
    return "fn-result-3"
  } else return "fn-results"
}

describe("testing data save on redis", () => {
  it("should save/retrieve data from redis", async () => {
    const ans = Keeper(
      {
        uri: "test-redis",
        options: { parseJSON: true, expire: 1 }
      },
      cacheUri,
      keygen,
      fn
    )
    const result = await ans(1)
    chai.assert.equal(result, "fn-results", "data cached")
  })
  it("should be able to retrieve data without cacheMiss", async () => {
    const ans = Keeper(
      {
        uri: "test-redis",
        options: { parseJSON: true, expire: 1 }
      },
      cacheUri,
      keygen,
      fn
    )
    const result = await ans(1)
    chai.assert.equal(counter, 1, "onCacheMiss called once")
  })
  it("should be able to save data with new key with cacheMiss", async () => {
    const ans = Keeper(
      {
        uri: "test-redis",
        options: { parseJSON: true, expire: 1 }
      },
      cacheUri,
      keygen,
      fn
    )
    const result = await ans(2)
    chai.assert.equal(result, "fn-results", "new data cached")
    chai.assert.equal(counter, 2, "onCacheMiss called twice")
  })
  it("should call cacheMiss again", async () => {
    await delay(1000)
    const ans = Keeper(
      {
        uri: "test-redis",
        options: { parseJSON: true, expire: 1 }
      },
      cacheUri,
      keygen,
      fn
    )
    const result = await ans(1)
    chai.assert.equal(counter, 3, "onCacheMiss called thrice")
  })
  it("should save cache indefinitely if time set as 0", async () => {
    const ans = Keeper(
      {
        uri: "test-redis",
        options: { parseJSON: true, expire: 0 }
      },
      cacheUri,
      keygen,
      fn
    )
    await ans(3)
    await delay(1500)
    const result = await ans(3)
    chai.assert.equal(result, "fn-result-3", "value retained after 1.5s")
  })
  it("multi chain should work fine", async () => {
    const ioRedisPoolOpts = Pool.IORedisPoolOptions.fromUrl(cacheUri)
      // This accepts the RedisOptions class from ioredis as an argument
      // https://github.com/luin/ioredis/blob/master/lib/redis/RedisOptions.ts
      .withIORedisOptions({
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000)
          return delay
        }
      })
      // This accepts the Options class from @types/generic-pool as an argument
      // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/generic-pool/index.d.ts#L36
      .withPoolOptions({
        min: 2,
        max: 15,
        acquireTimeoutMillis: 1000,
        maxWaitingClients: 5
      })
    const pool = new Pool.IORedisPool(ioRedisPoolOpts)
    const pipelineResult = await pool.execCommands([["set", "testMulti", "5"], ["get", "testMulti"], ["incr", "testMulti"], ["decr", "testMulti"]])
    await delay(1500)
    const getResult = await pool.get("testMulti")
    chai.assert.equal(getResult, "5", "testMulti on pool should get the set value")
  })
  after(() => {
    createRedisStub.restore()
  })
})
