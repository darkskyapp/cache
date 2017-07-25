"use strict";
const Bluebird = require("bluebird");
const log = require("log");

function _log(event, hit, success, start) {
  const duration_ms = Date.now() - start;

  log.debug(
    {
      event: event,
      hit: hit,
      success: success,
      duration_ms: duration_ms,
    },
    event + " " + (success? "succeeded": "failed") + " cache " +
      (hit? "hit": "miss") + " in " + duration_ms + " ms"
  );
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

    // If we're past the expiry, then nuke the cache.
    if(now >= this._expires) {
      this._promise = null;
    }

    // Get data from the backing function if not cached.
    let hit = true;
    if(this._promise === null) {
      const promise = this.promise();
      promise.bind(this).catch(this.clear);

      this._promise = promise;
      this._expires = now + this.expiry;
      hit = false;
    }

    // Log the cache event.
    Bluebird.join(
      "Cache." + this.event,
      hit,
      this._promise.return(true).catchReturn(false),
      now,
      _log
    );

    // Return the cached promise.
    return this._promise;
  }
}

module.exports = Cache;
