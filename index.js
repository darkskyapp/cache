"use strict";
const Bluebird = require("bluebird");
const log = require("@darkskyapp/log");

function _log(event, hit, success, start) {
  const duration_ms = Date.now() - start;

  log.debug({
      event: event,
      hit: hit,
      success: success,
      duration_ms: duration_ms,
      msg: event + " " + (success? "succeeded": "failed") + " cache " +
        (hit? "hit": "miss") + " in " + duration_ms + " ms",
  });
}

class Cache {
  constructor() {
    this._promise = null;
    this._expires = 0;
  }

  clear() {
    this._promise = null;
  }

  get event() {
    return "UNKNOWN";
  }

  get expiry() {
    return 0;
  }

  get() {
    const now = Date.now();

    // Get data from the backing function if not cached.
    let hit = true;
    if(this._promise === null || now >= this._expires) {
      const promise = this.promise();
      Bluebird.bind(this, promise).catch(this.clear);

      this._promise = promise;
      this._expires = now + this.expiry;
      hit = false;
    }

    // Log the cache event.
    Bluebird.join(
      "Cache." + this.event,
      hit,
      Bluebird.resolve(this._promise).return(true).catchReturn(false),
      now,
      _log
    );

    // Return the cached promise.
    return this._promise;
  }
}

module.exports = Cache;
