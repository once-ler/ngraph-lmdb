var lmdb = require('node-lmdb'),
  _=require('underscore'),
  lmdbWrapHelper = require('../lmdb-wrap-helper'),
  lmdbConfig = require('../lmdb-config');

function deepClone(doc) {
  return JSON.parse(JSON.stringify(doc));
}

function makeDbReadOnly(dbConfig) {
  var cloned = deepClone(dbConfig);
  cloned.readOnly = true;
  return dbConfig;
}

function PipeCursor(db, filter) {
  if (db.search(/(vertex|both|in|out)/) == -1) {
    throw new Error('Expect "vertex", "both", "in", "out" as parameter');
  }
  
  this.setupDb();

  var mapDb = {
    "vertex": this.vertexDb,
    "both": this.bothEdgeDb,
    "in": this.inEdgeDb,
    "out": this.outEdgeDb
  };

  this.txn = lmdbWrapHelper.env.beginTxn();
  this.cursor = new lmdb.Cursor(this.txn, mapDb[db]);
  this.index = -1;

  if (filter){
    
    if (typeof filter == 'string'){
      this.cursor.goToKey(filter);  
    }
    if (typeof filter == 'object') {
      //Entire collection?
      while (true) {
        if(this.moveNext()){
          this.current(function(err, d){
            
            if (_.findWhere([d], filter)){
              //found! break
              return false;
            }
            else {
              return true;
            }

          });
        }
        return false;
      }
    }    
  }
  
};
PipeCursor.prototype.setupDb = function() {
  this.env = new lmdb.Env();
  this.env.open(lmdbConfig.env);
  
  this.vertexDb = this.env.openDbi(lmdbConfig.vertexDb);
  this.edgeDb = this.env.openDbi(lmdbConfig.edgeDb);
  this.bothEdgeDb = this.env.openDbi(lmdbConfig.bothEdgeDb);
  this.inEdgeDb = this.env.openDbi(lmdbConfig.inEdgeDb);
  this.outEdgeDb = this.env.openDbi(lmdbConfig.outEdgeDb);
  
}
PipeCursor.prototype.moveNext = function() {
  this.index++;

  this._current = this.cursor.goToNext();
  if (this._current) {
    return true;
  }
  else {
    //shut down
    this.close();
    return false;
  }
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
  console.log('closing cursor...');
  this.cursor.close();
  this.txn.abort();

  this.vertexDb.close();
  this.edgeDb.close();
  this.bothEdgeDb.close();
  this.inEdgeDb.close();
  this.outEdgeDb.close();
  this.env.close();

};

module.exports = PipeCursor;