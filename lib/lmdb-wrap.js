var lmdb = require('node-lmdb'),
  fs = require('fs'),
  lmdbConfig = require('./lmdb-config'),
  lmdbWrapHelper = require('./lmdb-wrap-helper'),
  coreObjects = require('./core-objects');
  
module.exports = function(config) {

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
  var getNode = function (nodeId, callback) {
    return lmdbWrapHelper.getBinary(vertexDb, nodeId);
  };

  var getLink = function (linkId, callback) {
    return lmdbWrapHelper.getBinary(edgeDb, linkId);
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
          lmdbWrapHelper.delete(edgeDb, linkId);
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
    if (lmdbWrapHelper.get(bothEdgeDb, nodeId)){
      lmdbWrapHelper.delete(bothEdgeDb, nodeId);
    }    
    if (lmdbWrapHelper.get(inEdgeDb, nodeId)){
      lmdbWrapHelper.delete(inEdgeDb, nodeId);
    }
    if (lmdbWrapHelper.get(outEdgeDb, nodeId)){
      lmdbWrapHelper.delete(outEdgeDb, nodeId);
    }
    return true;
  };

  var removeNode = function (nodeId) {
    var node = getNode(nodeId);
    if (!node) { return false; }

    //Remove all links associated with this node
    removeLink(nodeId);

    lmdbWrapHelper.delete(vertexDb, nodeId);
    lmdbWrapHelper.decrNumber(statsDb, 'nodesCount');

    return true;
  }

  var hasLink = function (fromNodeId, toNodeId) {
    throw new Error('hasLink not implemented');
  };

  var addNode = function(nodeId, data) {

    var node = getNode(nodeId);
    
    if (!node) {
      node = new coreObjects.Node(nodeId);
      lmdbWrapHelper.incrNumber(statsDb,'nodesCount');
    }

    node.data = data;

    lmdbWrapHelper.putBinary(vertexDb, nodeId, node);
    
    return node;

  };

  var addLink = function (fromId, toId, label, data) {
    
    //Create nodes if not exist
    var fromNode = addNode(fromId);
    var toNode = addNode(toId);

    //Create link keys
    var linkId = fromId + ':' + label + ':' + toId;

    //Is this MultiEdge?
    var isMultiEdge = lmdbWrapHelper.getNumber(multiEdgesDb, linkId);
    if (!isMultiEdge) {
      lmdbWrapHelper.putNumber(multiEdgesDb, linkId, 1);
    }
    else {                    
      lmdbWrapHelper.incrNumber(multiEdgesDb,linkId);
      linkId += '@' + (isMultiEdge);      
    }

    var link = new coreObjects.Link(fromId, toId, label, data, linkId);

    lmdbWrapHelper.putString(bothEdgeDb, fromId, linkId);
    lmdbWrapHelper.putString(bothEdgeDb, toId, linkId);
    lmdbWrapHelper.putString(inEdgeDb, toId, linkId);
    lmdbWrapHelper.putString(outEdgeDb, fromId, linkId);
    lmdbWrapHelper.putBinary(edgeDb, linkId, link);
    
    lmdbWrapHelper.incrNumber(statsDb,'linksCount');

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

  return {

    addNode: addNode,

    addLink: addLink,

    removeLink: removeLink,

    removeNode: removeNode,

    getNode : getNode,

    getNodesCount : function () {
      return lmdbWrapHelper.getNumber(statsDb, 'nodesCount');
    },

    getLinksCount : function () {
        return lmdbWrapHelper.getNumber(statsDb, 'linksCount');
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
      throw new Error('forEachLinkedNode not implemented');
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
      vertexDb.drop();
      env.openDbi(lmdbConfig.vertexDb.)  
      //dispose(edgeDb);
      edgeDb.drop();
      env.openDbi(lmdbConfig.edgeDb);  
      //dispose(bothEdgeDb);
      bothEdgeDb.drop();
      env.openDbi(lmdbConfig.bothEdgeDb);  
      //dispose(inEdgeDb);
      inEdgeDb.drop();
      env.openDbi(lmdbConfig.inEdgeDb);  
      //dispose(outEdgeDb);
      outEdgeDb.drop();
      env.openDbi(lmdbConfig.outEdgeDb);  
      //dispose(multiEdgesDb);
      multiEdgesDb.drop();
      env.openDbi(lmdbConfig.multiEdgesDb);  
      
      lmdbWrapHelper.putNumber(statsDb, 'nodesCount', 0);
      lmdbWrapHelper.putNumber(statsDb, 'linksCount', 0);
        
    }

  }

}