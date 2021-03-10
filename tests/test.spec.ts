import * as chai from "chai"
import { Keeper } from "../src/index"
import * as RedisMock from "ioredis-mock"
import * as events from "events"
const eventEmitter = new events.EventEmitter()
let counter = 0
const l1 = function listener() {
  counter++
}
eventEmitter.addListener("ping", l1)
const redis = new RedisMock()

const getCache = (a: string) => redis

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
      getCache,
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
      getCache,
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
      getCache,
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
      getCache,
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
      getCache,
      keygen,
      fn
    )
    await ans(3)
    await delay(1500)
    const result = await ans(3)
    chai.assert.equal(result, "fn-result-3", "value retained after 1.5s")
  })
})
