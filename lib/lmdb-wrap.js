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
  
  var dispose = function(db, callback) {

    db.createKeyStream()
    .on('data', function (key) {
      db.del(key);
    })
    .on('end', function(){
      callback();
    })
  };

  var getNumber = function(key, callback) {
    statsDb.get(key, function (err, value) {
      if (err) {
        return callback(null,0);
      }
      callback(null,value);
    });
  };

  var putNumber = function(key, value, callback){
    statsDb.put(key, value, function(err){
      callback(null, value);
    })    
  };

  var incrNumber = function(key,callback){

    async.waterfall([
        function(next){
          getNumber(key,next);
        },
        function(value,next){
          putNumber(key, ++value, next);
        }
      ], function(err,value){ 
      callback(null,value);
    });

  };

  var decrNumber = function(key,callback){

    async.waterfall([
        function(next){
          getNumber(key,next);
        },
        function(value,next){
          if (value > 0){
            putNumber(key, --value, next);
          }
          else {
            next(null, value);
          }
        }
      ], function(err,value){ 
      callback(null,value);
    });

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
        async.parallel([
          function(cb1) {
            edgeDb.del(link.id, cb1);
          },
          function(cb1){
            decrNumber('linksCount', cb1)
          }], function(err){
            next(cb, link);
          });
      }
      function(link, cb){

        async.each([link.fromId, link.toId], 
          function(id, cb1){

            var callback = function(err, node){
            
              if (node){
                idx = coreObjects.indexOfElementInArray(link, node.links);
                if (idx >= 0) {
                    node.links.splice(idx, 1);
                    //Update node
                    vertexDb.put(nodeId, data, cb1);
                }
                else {
                  cb1();
                }
              }
              else {
                cb1();
              }

            };

            getNode(id, callback);

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

  var hasLink = function (fromNodeId, toNodeId, callback) {
    
    var next = function(err, node){

      //No node
      if (!node) {
        if (callback){
          return callback(null, null);
        }
        else {
          return null;
        }
      }

      //Node and link exists
      var i;
      for (i = 0; i < node.links.length; ++i) {
          var link = node.links[i];
          if (link.fromId === fromNodeId && link.toId === toNodeId) {
          
            //Link exists!
            if (callback){
              return callback(null,link)
            } 
            else {
              return link;
            }
          }
      }

      //No link
      if (callback){
        return callback(null, null);
      }
      else {
        return null;
      }
    
    };

    getNode(fromNodeId, next);

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
        async.waterfall([
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
          }], function(err, node){
            next(null, node);
          });
      }
      toNode: function(next){
        async.waterfall([
          function(cb){
            getNode(toId, cb);
          },
          function(node, cb){

            if (node){
              cb(null, node);
            }
            else {
              addNode(toId,null,cb);
            }
          }], function(err, node){
            next(null, node);
          });
      }
    }, function(err, nodeResults){

      var linkId = fromId + linkConnectionSymbol + toId;

      async.parallel({
        isMultiEdge: function(cb1){
          getNumber(linkId, cb1);
        },
        hasLink: function(cb1){
          hasLink(fromId, toId, cb1);
        }
      }, function(err,r){

        var lastly = function() {

          var link = new coreObjects.Link(fromId, toId, data, linkId);

          async.parallel([
            function(cb2){
              addLink(linkId, link, cb2);
            },
            function(cb2){
              incrNumber('linksCount', cb2);
            },
            function(cb2){
              nodeResults.fromNode.links.push(link);
              nodeResults.toNode.links.push(link);
              
              vertexDb.batch()
              .put(fromId, nodeResults.fromNode)
              .put(toId, nodeResults.toNode)
              .write(function () {
                cb2();  
              });
            }],
            function(err){
              //Return to client
              if (callback){
                callback(null, link);
              }
              else {
                return link;
              }
            });
        }

        if (r.isMultiEdge || r.hasLink){
          
          async.waterfall([
            function(cb1){

              if (!r.isMultiEdge) {
                putNumber(linkId,0,cb1);
              }
              else {
                incrNumber(linkId,cb1);
              }
            },
            function(value, cb1){
              cb1(null, linkId += '@' + value);
            }], function(err, value){
              linkId = value;
              lastly();
            })

        }
        else {
          lastly();
        }

      });

    });

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

    hasLink: hasLink,

    getNodesCount : function () {
      var callback = function(err,value){
        return value;
      }
      getNumber('nodesCount', callback);
    },

    getLinksCount : function () {
      var callback = function(err,value){
        return value;
      }
      getNumber('linksCount', callback);
    },

    getLinks : function (nodeId) {
      
      var callback = function (err, node){
        return return node ? node.links : null;
      }
      getNode(nodeId, callback);                 
    },

    forEachNode : function (callback) {
      if (typeof callback !== 'function') {
          return;
      }
      
      vertexDb.createReadStream()
      .on('data', function (data) {
        if (callback(data.value)){
          this.destroy();
          return;            
        }
      });

    },

    forEachLinkedNode : function (nodeId, callback, oriented) {
      
      var next = function(err,node){

        var i,
          link,
          linkedNodeId;

        if (node && node.links && typeof callback === 'function') {
          
          if (oriented) {
              for (i = 0; i < node.links.length; ++i) {
                  link = node.links[i];
                  if (link.fromId === nodeId) {
                      
                      var cb = function(err, inNode){
                        callback(inNode, link);
                      };
                      getNode(link.toId, cb);
                      //var inNode = getNode(link.toId);
                      //callback(inNode, link);
                  }
              }
          } else {
              for (i = 0; i < node.links.length; ++i) {
                  link = node.links[i];
                  linkedNodeId = link.fromId === nodeId ? link.toId : link.fromId;

                  var cb = function(err, linkedNode){
                    callback(linkedNode, link);
                  };
                  
                  getNode(linkedNodeId, cb);
                  //var linkedNode = getNode(linkedNodeId);
                  //callback(linkedNode, link);
              }
          }
        }

      }

      getNode(nodeId, next);

    },

    forEachLink : function (callback) {
      var i, length;
      if (typeof callback === 'function') {
          
          edgeDb.createReadStream()
            .on('data', function(){
              callback(data.value);
            });
      }
    },

    clear: function () {
        
        async.parallel([
          function (cb){
            dispose(vertexDb, cb);
          },
          function(cb){
            statsDb.put('nodesCount', 0, cb);
          },
          function(cb){
            dispose(edgeDb, cb);
          },
          function(cb){
            statsDb.put('linksCount', 0, cb);
          },
          function(cb){
            dispose(multiEdgesDb, cb);
          }]);        
    }

  }

}