var lmdb = require('node-lmdb'),
  lmdbConfig = require('./lmdb-config');

var env = new lmdb.Env();
env.open(lmdbConfig.env);

var vertexDb = env.openDbi(lmdbConfig.vertexDb);
var edgeDb = env.openDbi(lmdbConfig.edgeDb);
var bothEdgeDb = env.openDbi(lmdbConfig.bothEdgeDb);
var inEdgeDb = env.openDbi(lmdbConfig.inEdgeDb);
var outEdgeDb = env.openDbi(lmdbConfig.outEdgeDb);
var statsDb = env.openDbi(lmdbConfig.statsDb);
var multiEdgesDb = env.openDbi(lmdbConfig.multiEdgesDb);
var indexVertexDb = env.openDbi(lmdbConfig.indexVertexDb);
var indexEdgeDb = env.openDbi(lmdbConfig.indexEdgeDb);

//lmdb wrap helper
var lmdbWrapHelper = {

  env: env,

  vertexDb: vertexDb,

  edgeDb: edgeDb,

  bothEdgeDb: bothEdgeDb,

  inEdgeDb: inEdgeDb,

  outEdgeDb: outEdgeDb,

  statsDb: statsDb,

  multiEdgesDb: multiEdgesDb,

  indexVertexDb: indexVertexDb,

  indexEdgeDb: indexEdgeDb,

  edges: {
    "both": bothEdgeDb,
    "in": inEdgeDb,
    "out": outEdgeDb
  },

  incrNumber: function(dbi, key) {
    var txn = env.beginTxn();
    var n = txn.getNumber(dbi, key);
    n = (!n ? 0 : n);
    n = ++n;
    txn.putNumber(dbi, key, n);
    txn.commit();
  },
  decrNumber: function(dbi, key) {
    var txn = env.beginTxn();
    var n = txn.getNumber(dbi, key);
    n = (!n ? 0 : n);
    n = (n == 0 ? 0 : --n);
    txn.putNumber(dbi, key, n);
    txn.commit();
  },
  putBinary: function(dbi, key, data) {
    var txn = env.beginTxn();
    var buffer = new Buffer(typeof data == 'string' ? data : JSON.stringify(data));
    txn.putBinary(dbi, key, buffer);
    txn.commit();
  },
  getBinary: function(dbi, key) {
    var txn = env.beginTxn();
    var buffer = txn.getBinary(dbi, key);
    txn.commit();
    var r = null;
    try {
      if (buffer) {
        r = JSON.parse(buffer.toString());
      }
    } catch (e) {
      //no op
    }
    return r;
  },
  /*
    Lightweight get, no JSON parse.
  */
  get: function(dbi, key) {
    var txn = env.beginTxn();
    var buffer = txn.getBinary(dbi, key);
    txn.commit();
    return buffer;
  },
  putString: function(dbi, key, data) {
    var txn = env.beginTxn();
    txn.putString(dbi, key, data);
    txn.commit();
    return data;
  },
  getString: function(dbi, key) {
    var txn = env.beginTxn();
    var value = txn.getString(dbi, key);
    txn.commit();
    return value;
  },
  getNumber: function(dbi, key) {
    var txn = env.beginTxn();
    var n = txn.getNumber(dbi, key);
    txn.commit();
    return n ? n : 0;
  },
  putNumber: function(dbi, key, data) {
    var txn = env.beginTxn();
    txn.putNumber(dbi, key, data);
    txn.commit();
    return data;
  },
  delete: function(dbi, key) {
    var txn = env.beginTxn();
    var buffer = txn.getBinary(dbi, key);
    if (buffer) {
      txn.del(dbi, key);
    }
    txn.commit();
  }
}

module.exports = lmdbWrapHelper;
