var lmdb = require('node-lmdb'),
  _=require("underscore"),
  lmdbWrapHelper = require('../lmdb-wrap-helper'),
  lmdbIndex = require('../lmdb-index'),
  lmdbConfig = require('../lmdb-config');

function PipeCursor(db, filter) {
  if (db.search(/(vertex|both|in|out)/) == -1) {
    throw new Error('Expect "vertex", "both", "in", "out" as parameter');
  }
  
  //Setup db environment for this pipe
  this.setupDb();
  this.setupDbIndex();

  var mapDb = {
    "vertex": this.vertexDb,
    "both": this.bothEdgeDb,
    "in": this.inEdgeDb,
    "out": this.outEdgeDb,
    "edge": this.edgeDb
  };

  this.txn = this.env.beginTxn();
  this.cursor = new lmdb.Cursor(this.txn, mapDb[db]);
  this.index = -1;

  if (filter){
    //console.log('lmdb-pipe-cursor->filter->' + filter)
    if (typeof filter == 'string'){
      
      if (db == 'vertex'){
        var hasKey = this.cursor.goToKey(filter);  
        if (hasKey){
          this.filterArr = [filter];
        }
      }
      else {
        var filters = filter.split(':');
        var nodeId = filters[0];
        //var edgeLabel = filters[1];
        var patt = new RegExp(filter, 'i');
        this.filterArr = [];
        var self = this;
        for (var found = this.cursor.goToRange(nodeId); found; found = this.cursor.goToNext()) {
          this.cursor.getCurrentString(function(key,val){
              if (patt.test(val)){
                self.filterArr.push(val);
              }
          });
        }
        //Now we have the edge keys
        //console.log('edge keys->'+this.filterArr);
        this.cursor.close();
        this.txn.reset();
        //this.txn.renew();
        //Change the cursor to edgeDb
        this.cursor = new lmdb.Cursor(this.txn, mapDb["edge"]);
      }

    }
    if (typeof filter == 'object') {
      
      this.filter = {};
      this.filterArr = [];
      var self = this;
      //TODO: Need to check whether its edge or vertice
      for(var k in filter){
        var results = self.indexVertexEngine.searchForDocuments(k+':'+filter[k]);
        for(var j in results){
          self.filter[results[j]] = true;
        }
      }

      //console.log(Object.keys(this.filter));
      self.filterArr = Object.keys(this.filter).slice();      

    }    
  }
  //else {
    //No filter, cursor goes to first item
    //var firstKey = this.cursor.goToFirst();
    //console.log('this.cursor.goToFirst()->'+firstKey);
    
  //}
};
PipeCursor.prototype.deepClone = function(doc) {
  return JSON.parse(JSON.stringify(doc));
}
PipeCursor.prototype.makeDbReadOnly = function(dbConfig) {
  var cloned = this.deepClone(dbConfig);
  cloned.readOnly = true;
  return dbConfig;
}
PipeCursor.prototype.setupDb = function() {
  this.env = new lmdb.Env();
  this.env.open(lmdbConfig.env);
  
  this.vertexDb = this.env.openDbi(this.makeDbReadOnly(lmdbConfig.vertexDb));
  this.edgeDb = this.env.openDbi(this.makeDbReadOnly(lmdbConfig.edgeDb));
  this.bothEdgeDb = this.env.openDbi(this.makeDbReadOnly(lmdbConfig.bothEdgeDb));
  this.inEdgeDb = this.env.openDbi(this.makeDbReadOnly(lmdbConfig.inEdgeDb));
  this.outEdgeDb = this.env.openDbi(this.makeDbReadOnly(lmdbConfig.outEdgeDb));
  
}
PipeCursor.prototype.setupDbIndex = function() {
  this.indexVertexDb = this.env.openDbi(this.makeDbReadOnly(lmdbConfig.indexVertexDb));
  this.indexVertexEngine = lmdbIndex();
  this.indexVertexEngine.init(this.env, this.indexVertexDb);
  
  this.indexEdgeDb = this.env.openDbi(this.makeDbReadOnly(lmdbConfig.indexEdgeDb));
  this.indexEdgeEngine = lmdbIndex();
  this.indexEdgeEngine.init(this.env, this.indexEdgeDb);
}
PipeCursor.prototype.moveNext = function() {
  this.index++;

  this._current = this.cursor.goToNext();
  if (this._current) {
    return true;
  }
  else {
    //shut down
    //this.close();
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
PipeCursor.prototype.goToKey = function(key){
  this._current = this.cursor.goToKey(key+'');
  return this._current;
}
PipeCursor.prototype.close = function() {
  console.log('closing cursor...');
  this.cursor.close();
  this.txn.abort();

  this.vertexDb.close();
  this.edgeDb.close();
  this.bothEdgeDb.close();
  this.inEdgeDb.close();
  this.outEdgeDb.close();
  this.indexVertexDb.close();
  this.indexEdgeDb.close()
  this.env.close();

};

module.exports = PipeCursor;