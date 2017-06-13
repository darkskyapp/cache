"use strict";
const Bluebird = require("bluebird"),
      Cache    = require("../index"),
      expect   = require("chai").expect;

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

  promise() {
    this._y++;
    return Bluebird.resolve(this._y);
  }
}

class FailCache extends TestCache {
  promise() {
    this._y++;
    return Bluebird.reject(new Error("sad"));
  }
}

describe("cache", function() {
  it("should only call the backing function once serially", () => {
    const test = new TestCache();

    return test.get().
      then(count => {
        expect(test.get_calls()).to.equal(1);
        expect(test.promise_calls()).to.equal(1);
        expect(count).to.equal(1);

        return test.get().
          then(count => {
            expect(test.get_calls()).to.equal(2);
            expect(test.promise_calls()).to.equal(1);
            expect(count).to.equal(1);

            return test.get().
              then(count => {
                expect(test.get_calls()).to.equal(3);
                expect(test.promise_calls()).to.equal(1);
                expect(count).to.equal(1);
              });
          });
      });
  });

  it("should only call the backing function once in parallel", () => {
    const test = new TestCache();

    return Bluebird.
      all([test.get(), test.get(), test.get()]).
      then(counts => {
        expect(test.get_calls()).to.equal(3);
        expect(test.promise_calls()).to.equal(1);
        expect(counts).to.deep.equal([1, 1, 1]);
      });
  });

  it("should call the backing function again on a timeout", () => {
    const test = new TestCache();

    return Bluebird.
      all([
        Bluebird.delay( 0).bind(test).then(test.get), // uncached
        Bluebird.delay( 0).bind(test).then(test.get), // cached
        Bluebird.delay(20).bind(test).then(test.get), // uncached
        Bluebird.delay(20).bind(test).then(test.get), // cached
        Bluebird.delay(20).bind(test).then(test.get), // cached
      ]).
      then(counts => {
        expect(test.get_calls()).to.equal(5);
        expect(test.promise_calls()).to.equal(2);
        expect(counts).to.deep.equal([1, 1, 2, 2, 2]);
      });
  });

  it("should not cache failures", () => {
    const test = new FailCache();

    /* called serially, we hit the backing function each time since there's no
     * caching on failure */
    return test.get().
      throw(new Error("promise should not resolve")).
      catch(err => {
        expect(test.get_calls()).to.equal(1);
        expect(test.promise_calls()).to.equal(1);
        expect(err).to.be.an.instanceof(Error).
          with.property("message", "sad");

        return test.get().
          throw(new Error("promise should not resolve")).
          catch(err => {
            expect(test.get_calls()).to.equal(2);
            expect(test.promise_calls()).to.equal(2);
            expect(err).to.be.an.instanceof(Error).
              with.property("message", "sad");

            /* but when called in parallel, it's only hit once because it takes
             * a while to get a response! */
            return Bluebird.
              all([test.get(), test.get()]).
              throw(new Error("promise should not resolve")).
              catch(err => {
                expect(test.get_calls()).to.equal(4);
                expect(test.promise_calls()).to.equal(3);
                expect(err).to.be.an.instanceof(Error).
                  with.property("message", "sad");
              });
          }
        );
      });
  });
});
