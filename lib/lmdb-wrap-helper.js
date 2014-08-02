var lmdb = require('node-lmdb');

//lmdb wrapp helper
var lmdbWrapHelper = {

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