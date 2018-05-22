"use strict";
const Bluebird = require("bluebird");
const Cache = require("./index");
const expect = require("chai").expect;

class TestCache extends Cache {
  constructor() {
    super();
    this._x = 0;
    this._y = 0;
  }

  get_calls() {
    return this._x;
  }

  promise_calls() {
    return this._y;
  }

  get() {
    this._x++;
    return super.get();
  }

  get expiry() {
    return 10;
  }

  async promise() {
    this._y++;
    return this._y;
  }
}

class FailCache extends TestCache {
  async promise() {
    this._y++;
    throw new Error("sad");
  }
}

describe("cache", function() {
  it("should only call the backing function once serially", async () => {
    const test = new TestCache();
    expect(await test.get()).to.equal(1);
    expect(test.get_calls()).to.equal(1);
    expect(test.promise_calls()).to.equal(1);

    expect(await test.get()).to.equal(1);
    expect(test.get_calls()).to.equal(2);
    expect(test.promise_calls()).to.equal(1);

    expect(await test.get()).to.equal(1);
    expect(test.get_calls()).to.equal(3);
    expect(test.promise_calls()).to.equal(1);
  });

  it("should only call the backing function once in parallel", async () => {
    const test = new TestCache();

    expect(await Bluebird.all([test.get(), test.get(), test.get()])).
      to.deep.equal([1, 1, 1]);
    expect(test.get_calls()).to.equal(3);
    expect(test.promise_calls()).to.equal(1);
  });

  it("should call the backing function again on a timeout", async () => {
    const test = new TestCache();
    const counts = await Bluebird.all([
      Bluebird.delay(0).bind(test).then(test.get), // uncached
      Bluebird.delay(0).bind(test).then(test.get), // cached
      Bluebird.delay(20).bind(test).then(test.get), // uncached
      Bluebird.delay(20).bind(test).then(test.get), // cached
      Bluebird.delay(20).bind(test).then(test.get), // cached
    ]);
    expect(counts).to.deep.equal([1, 1, 2, 2, 2]);
    expect(test.get_calls()).to.equal(5);
    expect(test.promise_calls()).to.equal(2);
  });

  it("should not cache failures", async () => {
    const test = new FailCache();

    // called serially, we hit the backing function each time since there's no
    // caching on failure
    try {
      await test.get();
      throw new Error("promise should not resolve");
    }
    catch(err) {
      expect(err).to.be.an.instanceof(Error).with.property("message", "sad");
      expect(test.get_calls()).to.equal(1);
      expect(test.promise_calls()).to.equal(1);
      await Bluebird.delay(1);

      try {
        await test.get();
        throw new Error("promise should not resolve");
      }
      catch(err) {
        expect(err).to.be.an.instanceof(Error).with.property("message", "sad");
        expect(test.get_calls()).to.equal(2);
        expect(test.promise_calls()).to.equal(2);
        await Bluebird.delay(1);

        // but when called in parallel, it's only hit once because it takes
        // a while to get a response!
        try {
          await Bluebird.all([test.get(), test.get()]);
          throw new Error("promise should not resolve");
        }
        catch(err) {
          expect(err).to.be.an.instanceof(Error).
            with.property("message", "sad");
          expect(test.get_calls()).to.equal(4);
          expect(test.promise_calls()).to.equal(3);
        }
      }
    }
  });
});
