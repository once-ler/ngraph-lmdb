var lmdb = require('node-lmdb'),
  lmdbConfig = require('./lmdb-config');

function deepClone(doc) {
  return JSON.parse(JSON.stringify(doc));
}

function makeDbReadOnly(dbConfig) {
  var cloned = deepClone(dbConfig);
  cloned.readOnly = true;
}

function PipeCursor(db) {
  if (db.search(/(vertex|both|in|out)/) == -1) {
    throw new Error('Expect "vertex", "both", "in", "out" as parameter');
  }

  var vertexDb = env.openDbi(makeDbReadOnly(lmdbConfig.vertexDb));
  var edgeDb = env.openDbi(makeDbReadOnly(lmdbConfig.edgeDb));
  var mapDb = {
    "vertex": vertexDb,
    "both": bothEdgeDb,
    "in": inEdgeDb,
    "out": outEdgeDb
  };

  this.txn = env.beginTxn();
  this.cursor = new lmdb.Cursor(this.txn, mapDb[db]);
  this.index = -1;
};
PipeCursor.prototype.moveNext = function() {
  this.index++;

  this._current = this.cursor.goToNext();
  if (this._current)
    return true;
  else
    return false;
};
PipeCursor.prototype.current = function(callback) {

  if (typeof this._current == "undefined") {
    return undefined;
  }

  this.cursor.getCurrentBinary(function(key, buffer) {
    var d = buffer.toString();
    try {
      d = JSON.parse(d);
    } catch (e) {
      //no op
    }
    //Pass back the cursor and txn so user can short circuit iterator
    callback(null, d, this.index, this.cursor, this.txn);
  });
};
PipeCursor.prototype.close = function() {
  this.cursor.close();
  this.txn.abort();
};

module.exports = PipeCursor;