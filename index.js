"use strict";
const Bluebird = require("bluebird");

class Cache {
  constructor(log) {
    this._log     = log;
    this._promise = null;
  }

  _expire() {
    return Bluebird.bind(this).delay(this.expiry).then(this.clear);
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

  static _log(log, event, hit, success, start) {
    if (!log) {
      return;
    }

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

  get() {
    const now = Date.now();

    /* Get data from the backing function if not cached. */
    let hit = true;
    if(this._promise === null) {
      hit = false;
      this._promise = this.promise();
      this._promise.bind(this).then(this._expire).catch(this.clear);
    }

    /* Log the cache event. */
    Bluebird.join(
      this._log,
      "Cache." + this.event,
      hit,
      this._promise.return(true).catchReturn(false),
      now,
      Cache._log
    );

    /* Return the cache promise. */
    return this._promise;
  }
}

module.exports = Cache;
