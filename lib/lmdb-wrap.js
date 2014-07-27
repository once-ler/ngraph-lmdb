var lmdb = require('node-lmdb'),
  fs = require('fs'),
  coreObjects = require('./core-objects');
  
module.exports = function(config) {

  //lmdb defaults
  var lmdbConfig = {

    appendOnly: false,

    env: {
        path: process.cwd() + "/mydata",
        mapSize: 8*1024*1024*1024, // maximum database size
        maxDbs: 10,
        noMetaSync: true,
        noSync: true
    },

    vertexDb: {
        name: "test:vertices",
        create: true // will create if database did not exist
    },

    edgeDb: {
        name: "test:edges",
        create: true
    },

    multiEdgesDb: {
        name: "test:multi-edges",
        create: true
    },

    bothEdgeDb: {
        name: "test:both-edges",
        create: true,
        dupSort: true
    },

    inEdgeDb: {
        name: "test:in-edges",
        create: true,
        dupSort: true
    },

    outEdgeDb: {
        name: "test:out-edges",
        create: true,
        dupSort: true
    },

    statsDb: {
        name: "test:stats",
        create: true
    }

  }

  //lmdb wrapper
  var lmdbWrap = {

    incrNumber: function(dbi, key){
        var txn = env.beginTxn();
        var n = txn.getNumber(dbi, key);
        n = (!n ? 0 : n);
        n = ++n;
        txn.putNumber(dbi, key, n);
        txn.commit();
    },
    decrNumber: function(dbi, key){
        var txn = env.beginTxn();
        var n = txn.getNumber(dbi, key);
        n = (!n ? 0 : n);
        n = (n == 0 ? 0 : --n); 
        txn.putNumber(dbi, key, n);
        txn.commit();
    },    
    putBinary: function(dbi, key, data){
        var txn = env.beginTxn();
        var buffer = new Buffer(typeof data == 'string' ? data : JSON.stringify(data));
        txn.putBinary(dbi, key, buffer);
        txn.commit();
    },
    getBinary: function(dbi, key){
        var txn = env.beginTxn();
        var buffer = txn.getBinary(dbi, key);
        txn.commit();
        var r = null;
        try {
          if (buffer){
              r = JSON.parse(buffer.toString());
          }
        }catch(e){
            //no op
        }
        return r;
    },
    /*
      Lightweight get, no JSON parse.
    */
    get: function(dbi, key){
      var txn = env.beginTxn();
      var buffer = txn.getBinary(dbi, key);
      txn.commit();
      return buffer;
    },
    putString: function(dbi, key, data){
        var txn = env.beginTxn();
        txn.putString(dbi, key, data);
        txn.commit();
        return data;
    },
    getString: function(dbi, key){
        var txn = env.beginTxn();
        var value = txn.getString(dbi, key);
        txn.commit();
        return value;
    },
    getNumber: function(dbi, key){
        var txn = env.beginTxn();
        var n = txn.getNumber(dbi, key);
        txn.commit();
        return n ? n : 0;
    },
    putNumber: function(dbi, key, data){
        var txn = env.beginTxn();
        txn.putNumber(dbi, key, data);
        txn.commit();
        return data;
    },
    delete: function(dbi, key){
        var txn = env.beginTxn();
        var buffer = txn.getBinary(dbi, key);
        if (buffer){
          txn.del(dbi, key);          
        }
        txn.commit();
    }
  }

  //Merge incoming options
  lmdbConfig = coreObjects.mergeOptions(lmdbConfig, config);
  //setup data path
  if (!fs.existsSync(lmdbConfig.env.path)) {
    fs.mkdirSync(lmdbConfig.env.path, 0777);
  }

  var env = new lmdb.Env();
  env.open(lmdbConfig.env);
  var vertexDb = env.openDbi(lmdbConfig.vertexDb);
  var edgeDb = env.openDbi(lmdbConfig.edgeDb);
  var bothEdgeDb = env.openDbi(lmdbConfig.bothEdgeDb);
  var inEdgeDb = env.openDbi(lmdbConfig.inEdgeDb);
  var outEdgeDb = env.openDbi(lmdbConfig.outEdgeDb);
  var statsDb = env.openDbi(lmdbConfig.statsDb);
  var multiEdgesDb = env.openDbi(lmdbConfig.multiEdgesDb);
  
  var edges = {
    "both": bothEdgeDb,
    "in": inEdgeDb,
    "out": outEdgeDb
  };
  
  //Private
  var dispose = function(dbi) {

    var txn = env.beginTxn();
    var cursor = new lmdb.Cursor(txn, dbi);
    for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
      try{
        cursor.del();
      }
      catch(e){

      }
    }
    cursor.close();
    txn.commit();
  };

  var getNode = function (nodeId, callback) {
    return lmdbWrap.getBinary(vertexDb, nodeId);
  };

  var getLink = function (linkId, callback) {
    return lmdbWrap.getBinary(edgeDb, linkId);
  };

  function deleteLink(nodeId, direction){

    if (direction.search(/^(in|out|both)$/i) == -1){
      return false;
    }

    //Get the link ids
    var links = [];
    var txn = env.beginTxn();
    var cursor = new lmdb.Cursor(txn, edges[direction]);    
    for (var found = (cursor.goToRange(nodeId) === nodeId); found; found = cursor.goToNextDup()) {      
      cursor.getCurrentString(function(key, linkId){
        links.push(linkId);
      });
    }
    cursor.close();
    txn.commit();

    //delete refs and actual links
    for(var k in links){
      var linkId = links[k];
      var link = getLink(linkId);
      
      if (link){

        if (direction == 'both'){
          lmdbWrap.delete(edgeDb, linkId);
        }
        else {
          var linkedNodeId = (direction == 'in' ? link.fromId : link.toId);
          var txn1 = env.beginTxn();
          var cursor1 = new lmdb.Cursor(txn1, direction == 'in' ? inEdgeDb : outEdgeDb);
          var found1 = cursor1.goToDup(linkedNodeId, linkId);
          if (found1){
            cursor1.del();
          }
          cursor1.close();
          txn1.commit();
        }

      }  
    }  

  }

  var removeLink= function (nodeId) {

    if (!nodeId) { return false; }
    
    //Delete all link refs with out nodes related to this node
    deleteLink(nodeId,'in');
    
    //Delete all link refs with in nodes related to this node
    deleteLink(nodeId,'out');
    
    //Delete all actual links related to this node
    deleteLink(nodeId,'both');
    
    //Delete links of itself
    if (lmdbWrap.get(bothEdgeDb, nodeId)){
      lmdbWrap.delete(bothEdgeDb, nodeId);
    }    
    if (lmdbWrap.get(inEdgeDb, nodeId)){
      lmdbWrap.delete(inEdgeDb, nodeId);
    }
    if (lmdbWrap.get(outEdgeDb, nodeId)){
      lmdbWrap.delete(outEdgeDb, nodeId);
    }
    return true;
  };

  var removeNode = function (nodeId) {
    var node = getNode(nodeId);
    if (!node) { return false; }

    //Remove all links associated with this node
    removeLink(nodeId);

    lmdbWrap.delete(vertexDb, nodeId);
    lmdbWrap.decrNumber(statsDb, 'nodesCount');

    return true;
  }

  var hasLink = function (fromNodeId, toNodeId) {
    // TODO: Use adjacency matrix to speed up this operation.
    var node = getNode(fromNodeId),
        i;
    if (!node) {
        return null;
    }

    for (i = 0; i < node.links.length; ++i) {
        var link = node.links[i];
        if (link.fromId === fromNodeId && link.toId === toNodeId) {
            return link;
        }
    }

    return null; // no link.
  };

  var addNode = function(nodeId, data) {

    var node = getNode(nodeId);
    
    if (!node) {
      node = new coreObjects.Node(nodeId);
      lmdbWrap.incrNumber(statsDb,'nodesCount');
    }

    node.data = data;

    lmdbWrap.putBinary(vertexDb, nodeId, node);
    
    return node;

  };

  var addLink = function (fromId, toId, label, data) {
    
    //Create nodes if not exist
    var fromNode = addNode(fromId);
    var toNode = addNode(toId);

    //Create link keys
    var linkId = fromId + ':' + label + ':' + toId;

    //Is this MultiEdge?
    var isMultiEdge = lmdbWrap.getNumber(multiEdgesDb, linkId);
    if (!isMultiEdge) {
      lmdbWrap.putNumber(multiEdgesDb, linkId, 1);
    }
    else {                    
      lmdbWrap.incrNumber(multiEdgesDb,linkId);
      linkId += '@' + (isMultiEdge);      
    }

    var link = new coreObjects.Link(fromId, toId, label, data, linkId);

    lmdbWrap.putString(bothEdgeDb, fromId, linkId);
    lmdbWrap.putString(bothEdgeDb, toId, linkId);
    lmdbWrap.putString(inEdgeDb, toId, linkId);
    lmdbWrap.putString(outEdgeDb, fromId, linkId);
    lmdbWrap.putBinary(edgeDb, linkId, link);
    
    lmdbWrap.incrNumber(statsDb,'linksCount');

    return link;

  };

  var getLinks = function (nodeId, direction) {
      
    if(!nodeId){
      return null;
    }

    var linkIds = [];
    var links = [];
    var txn = env.beginTxn();
    var db = edges[direction];
    var cursor = new lmdb.Cursor(txn, db ? db : bothEdgeDb);
    
    for (var found = (cursor.goToRange(nodeId) === nodeId); found; found = cursor.goToNextDup()) {
      cursor.getCurrentString(function(key, s){
        linkIds.push(s);
      });
    }
    cursor.close();
    txn.abort();    

    //Can't do a getString inside of the cursor
    for(var k in linkIds){
      var link = getLink(linkIds[k]);
      
      if (link){
        links.push(link);
      }
    }
    
    return links.length > 0 ? links : null;            
  }

  function deepClone(doc) {
    return JSON.parse(JSON.stringify(doc));
  }
  function makeDbReadOnly(dbConfig) {
    var cloned = deepClone(dbConfig);
    cloned.readOnly = true;
  }

  function PipeCursor(db) {
    if (db.search(/(vertex|edge)/)==-1){
      throw new Error('Expect "vertex" or "edge" as parameter');
    }

    var vertexDb = env.openDbi(makeDbReadOnly(lmdbConfig.vertexDb));
    var edgeDb = env.openDbi(makeDbReadOnly(lmdbConfig.edgeDb));
    var mapDb = { "vertex": vertexDb, "edge": edgeDb };

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

    if (typeof this._current == "undefined"){
      return undefined;
    }

    this.cursor.getCurrentBinary(function(key,buffer){
        var d = buffer.toString();
        try{
          d=JSON.parse(d);
        }
        catch(e){
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

  return {

    addNode: addNode,

    addLink: addLink,

    removeLink: removeLink,

    removeNode: removeNode,

    getNode : getNode,

    getNodesCount : function () {
      return lmdbWrap.getNumber(statsDb, 'nodesCount');
    },

    getLinksCount : function () {
        return lmdbWrap.getNumber(statsDb, 'linksCount');
    },

    getLinks : getLinks,

    forEachNode : function (callback) {
      if (typeof callback !== 'function') {
          return;
      }
      
      var txn = env.beginTxn();
      var cursor = new lmdb.Cursor(txn, vertexDb);
      for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
          cursor.getCurrentBinary(function(key,buffer){
              var d = buffer.toString();
              try{
                d=JSON.parse(d);
              }
              catch(e){
                //no op
              }
              if (callback(d)){
                  cursor.close();
                  txn.commit();
                  return;
              }
          });
      }
      cursor.close();
      txn.commit();

    },

    forEachLinkedNode : function (nodeId, callback, oriented) {
      var node = getNode(nodeId),
          i,
          link,
          linkedNodeId;

      if (node && node.links && typeof callback === 'function') {
          // Extraced orientation check out of the loop to increase performance
          if (oriented) {
              for (i = 0; i < node.links.length; ++i) {
                  link = node.links[i];
                  if (link.fromId === nodeId) {
                      //callback(nodes[link.toId], link);
                      var inNode = getNode(link.toId);
                      callback(inNode, link);
                  }
              }
          } else {
              for (i = 0; i < node.links.length; ++i) {
                  link = node.links[i];
                  linkedNodeId = link.fromId === nodeId ? link.toId : link.fromId;

                  //callback(nodes[linkedNodeId], link);
                  var linkedNode = getNode(linkedNodeId);
                  callback(linkedNode, link);
              }
          }
      }
    },

    forEachLink : function (callback) {
      var i, length;
      if (typeof callback === 'function') {
          /*
          for (i = 0, length = links.length; i < length; ++i) {
              callback(links[i]);
          }
          */
          var txn = env.beginTxn();
          var cursor = new lmdb.Cursor(txn, edgeDb);
          for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
              cursor.getCurrentBinary(function(key,buffer){
                  var d = buffer.toString();
                  try{
                    d=JSON.parse(d);
                  }
                  catch(e){
                    //no op
                  }
                  callback(d);
              });
          }
          cursor.close();
          txn.commit();

      }
    },

    hasLink: hasLink,

    clear: function () {
        
        //dispose(vertexDb);
        //dispose(edgeDb);
        //dispose(inEdgeDb);
        //dispose(outEdgeDb);
        lmdbWrap.putNumber(statsDb, 'nodesCount', 0);
        lmdbWrap.putNumber(statsDb, 'linksCount', 0);
        
    }

  }

}