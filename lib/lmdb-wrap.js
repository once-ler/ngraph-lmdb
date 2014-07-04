var lmdb = require('level-lmdb'),
  async  require('async'),
  coreObjects = require('./core-objects');
  
modules.exports = function(config) {

  var lmdbConfig = { path: process.cwd() + "/mydata" };
  var path = lmdbConfig.path;

  //Merge incoming options
  lmdbConfig = coreObjects.mergeOptions(lmdbConfig, config);
  
  //setup data path
  if (!fs.existsSync(lmdbConfig.path)) {
    fs.mkdirSync(lmdbConfig.path, 0777);
  }

  var vertexDb = lmdb(path + '/vertices',{createIfMissing:true,valueEncoding:'json'});
  vertexDb.open();
  var edgeDb = lmdb(path + '/edges',{createIfMissing:true,valueEncoding:'json'});
  edgesDb.open();
  var multiEdgesDb = lmdb(path + '/multi-edges',{createIfMissing:true,valueEncoding:'json'});
  multiEdgesDb.open();
  var statsDb = lmdb(path + '/stats',{createIfMissing:true});
  statsDb.open();
  var linkConnectionSymbol = '->';
  
  //Private
  var dispose = function(db, callback) {

    db.createKeyStream()
    .on('data', function (key) {
      db.del(key);
    })
    .on('end', function(){
      callback();
    })
  };


  var getNode = function (nodeId, callback) {

    vertexDb.get(nodeId, function (err, value) {
      if (err) {
        return callback(null,null);
      }
      callback(null,value);
    });
  };

  var getLink = function (edgeId, callback) {
    edgeDb.get(nodeId, function (err, value) {
      if (err) {
        return callback(null,null);
      }
      callback(null,value);
    });
  };

  var removeLink = function (link, callback) {

    if (!link) { return callback(null,false); }

    async.waterfall([
      function(cb){
        getLink(link.id, cb);
      },
      function(link, cb){
        if (!link){
          cb('link is null');
        }
        else {
          cb(null, link);
        }
      },
      function(link, cb){
        edgeDb.del(link.id, function(err){ cb(null,link); });
        // lmdbWrap.decrNumber(statsDb,'linksCount');
      }
      function(link, cb){

        async.each([link.fromId, link.toId], function(id, cb1){

          var node = getNode(id, function(err, node){
            
            if (node){
              idx = coreObjects.indexOfElementInArray(link, node.links);
              if (idx >= 0) {
                  node.links.splice(idx, 1);
                  //save it
                  vertexDb.put(nodeId, data, cb1);
              }
            }
            else {
              cb1();
            }

          });
        }, function(err){
          cb(null, link);
        });

      }], function(err, results){
        if (err)
          callback(null,false);
        else
          callback(null,true);
      });
  };

  var hasLink = function (fromNodeId, toNodeId) {
    
    var callback = function(err, node){

      if (!node) {
          return null;
      }
      var i;
      for (i = 0; i < node.links.length; ++i) {
          var link = node.links[i];
          if (link.fromId === fromNodeId && link.toId === toNodeId) {
              return link;
          }
      }

      return null; // no link.
    };

    getNode(fromNodeId, callback);

  };

  var addNode = function(nodeId, data, callback) {

    async.waterfall([function(cb){
      getNode(nodeId,cb);
    }, function(node,cb){
      if (!node) {
        node = new coreObjects.Node(nodeId);
        lmdbWrap.incrNumber(statsDb,'nodesCount');
        node.data  data;
        cb(null, node)
    }, function(node,cb){
      vertexDb.put(nodeId, node, function(err){
        cb(null, node);
      })
    }], function(err, node){
      if (callback){
        callback(null, node);
      }
      else { return node; }        
    });
  };

  var addLink = function(fromId, toId, data, callback){
    
    async.parallel({
      fromNode: function(next){
        async.waterfall(
          function(cb){
            getNode(fromId, cb);
          },
          function(node, cb){

            if (node){
              cb(null, node);
            }
            else {
              addNode(fromId,null,cb);
            }
          }, function(err, node){
            next(null, node);
          });
      }
      toNode: function(next){

      }
    }, function(err,link){

      if (callback){
        callback(null, link);
      }
      else {
        return link;
      }

    });


    var fromNode = getNode(fromId) || addNode(fromId);
    var toNode = getNode(toId) || addNode(toId);

    var linkId = fromId.toString() + linkConnectionSymbol + toId.toString();
    
    var isMultiEdge = lmdbWrap.getNumber(multiEdgesDb, linkId);
    if (isMultiEdge || hasLink(fromId, toId)) {
        if (!isMultiEdge) {
            lmdbWrap.putNumber(multiEdgesDb, linkId, 0);                    
        }
        
        lmdbWrap.incrNumber(multiEdgesDb,linkId);
        linkId += '@' + (lmdbWrap.getNumber(multiEdgesDb, linkId));
    }

    var link = new coreObjects.Link(fromId, toId, data, linkId);

    lmdbWrap.putBinary(edgeDb, linkId, link);
    lmdbWrap.incrNumber(statsDb,'linksCount');

    fromNode.links.push(link);
    toNode.links.push(link);

    lmdbWrap.putBinary(vertexDb, fromId, fromNode);
    lmdbWrap.putBinary(vertexDb, toId, toNode);

    return link;

  }

  var removeNode = function (nodeId, callback) {
    var node = getNode(nodeId);
    if (!node) { return false; }

    for(var k in node.links) {
      var link = node.links[k];
      removeLink(link);
    }

    lmdbWrap.delete(vertexDb, nodeId);
    
    lmdbWrap.decrNumber(statsDb, 'nodesCount');

    return true;
  };

  return {

    addNode: addNode,

    addLink: addLink,

    removeLink: removeLink,

    removeNode: removeNode,

    getNode : getNode,

    getNodesCount : function () {
      return lmdbWrap.getNumber(statsDb, 'nodesCount');
      //return nodesCount;
    },

    getLinksCount : function () {
        return lmdbWrap.getNumber(statsDb, 'linksCount');
        //return links.length;
    },

    getLinks : function (nodeId) {
      
      var node = getNode(nodeId);
      return node ? node.links : null;            
    },

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
        
        async.parallel([
          function (cb){
            dispose(vertexDb, cb);
          },
          function(cb){
            statsDb.put('nodesCount',0,cb);
          }

          ], function(err){
            dispose(edgeDb, cb);
          })
        lmdbWrap.putNumber(statsDb, 'linksCount', 0);
        dispose(multiEdgesDb);

    }

  }

}