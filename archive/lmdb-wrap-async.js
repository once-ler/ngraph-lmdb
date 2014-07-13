var lmdb = require('level-lmdb'),
//var levelup = require('levelup'),
//  lmdb = require('lmdb'),  
  async = require('async'),
  coreObjects = require('./core-objects');

module.exports = function (config) {

  var lmdbConfig = {
    path: process.cwd() + "/mydata"
  };
  var path = lmdbConfig.path;

  //Merge incoming options
  lmdbConfig = coreObjects.mergeOptions(lmdbConfig, config);

  //setup data path
  if (!fs.existsSync(lmdbConfig.path)) {
    fs.mkdirSync(lmdbConfig.path, 0777);
  }

  var vertexDb = lmdb(path + '/vertices', {
    //db: lmdb,
    createIfMissing: true,
    valueEncoding: 'json'
  });
  vertexDb.open(function (err) {
    if (err)
      throw err;
  });

  var edgeDb = lmdb(path + '/edges', {
    //db: lmdb,
    createIfMissing: true,
    valueEncoding: 'json'
  });
  edgeDb.open(function (err) {
    if (err)
      throw err;
  });

  var multiEdgesDb = lmdb(path + '/multi-edges', {
    //db: lmdb,
    createIfMissing: true,
    valueEncoding: 'json'
  });
  multiEdgesDb.open(function (err) {
    if (err)
      throw err;
  });

  var statsDb = lmdb(path + '/stats', {
    //db: lmdb,
    createIfMissing: true
  });
  statsDb.open(function (err) {
    if (err)
      throw err;
  });

  var linkConnectionSymbol = '->';

  var dispose = function (db, callback) {

    db.createKeyStream()
      .on('data', function (key) {
        db.del(key);
      })
      .on('end', function () {
        callback();
      })
  };

  var getNumber = function (dbi, key, callback) {
    dbi.get(key, function (err, value) {
      if (err) {
        return callback(null, 0);
      }
      if (callback) {
        callback(null, +value);
      } else {
        return +value;
      }
    });
  };

  var putNumber = function (dbi, key, value, callback) {
    dbi.put(key, value, function (err) {
      if (err) {
        throw err;
      }
      if (callback) {
        callback(null, +value);
      } else {
        return +value;
      }
    })
  };

  var incrNumber = function (dbi, key, callback) {

    async.waterfall([

      function (next) {
        getNumber(dbi, key, next);
      },
      function (value, next) {
        putNumber(dbi, key, ++value, next);
      }
    ], function (err, value) {
      if (callback) {
        callback(null, +value);
      } else {
        return +value;
      }
    });

  };

  var decrNumber = function (dbi, key, callback) {

    async.waterfall([

      function (next) {
        getNumber(dbi, key, next);
      },
      function (value, next) {
        if (+value > 0) {
          putNumber(dbi, key, --value, next);
        } else {
          next(null, value);
        }
      }
    ], function (err, value) {
      if (callback) {
        callback(null, +value);
      } else {
        return +value;
      }
    });

  };

  var getNode = function (nodeId, callback) {

    vertexDb.get(nodeId, function (err, value) {
      if (err) {

        if (callback)
          return callback(null, null);
        else
          return null;
      }

      if (callback) {
        callback(null, value);
      } else {
        return value;
      }
    });
  };

  var getLink = function (edgeId, callback) {

    edgeDb.get(edgeId, function (err, value) {
      if (err) {
        
        if (callback)
          return callback(null, null);
        else
          return null;
      }

      if (callback) {
        callback(null, value);
      } else {
        return value;
      }
    });
  };

  var removeLink = function (link, callback) {

    if (!link) {
      return callback(null, false);
    }

    async.waterfall([

      function (cb) {
        getLink(link.id, cb);
      },
      function (link, cb) {
        if (!link) {
          cb('link is null');
        } else {
          cb(null, link);
        }
      },
      function (link, cb) {
        async.parallel([

          function (cb1) {
            edgeDb.del(link.id, cb1);
          },
          function (cb1) {
            decrNumber(statsDb, 'linksCount', cb1)
          }
        ], function (err) {
          next(cb, link);
        });
      },
      function (link, cb) {

        async.each([link.fromId, link.toId],
          function (id, cb1) {

            var callback = function (err, node) {

              if (node) {
                idx = coreObjects.indexOfElementInArray(link, node.links);
                if (idx >= 0) {
                  node.links.splice(idx, 1);
                  //Update node
                  vertexDb.put(nodeId, data, cb1);
                } else {
                  cb1();
                }
              } else {
                cb1();
              }

            };

            getNode(id, callback);

          }, function (err) {
            cb(null, link);
          });

      }
    ], function (err, results) {
      if (err)
        callback(null, false);
      else
        callback(null, true);
    });
  };

  var hasLink = function (fromNodeId, toNodeId, callback) {

    var next = function (err, node) {

      //No node
      if (!node) {
        if (callback) {
          return callback(null, null);
        } else {
          return null;
        }
      }

      //Node and link exists
      var i;
      for (i = 0; i < node.links.length; ++i) {
        var link = node.links[i];
        if (link.fromId === fromNodeId && link.toId === toNodeId) {

          //Link exists!
          if (callback) {
            return callback(null, link)
          } else {
            return link;
          }
        }
      }

      //No link
      if (callback) {
        return callback(null, null);
      } else {
        return null;
      }

    };

    getNode(fromNodeId, next);

  };

  var addNode = function (nodeId, data, callback) {

    async.waterfall([
      function (cb) {
        getNode(nodeId, cb);
      },
      function (node, cb) {
        if (!node) {
          node = new coreObjects.Node(nodeId);
          node.data = data ? data : {};
          incrNumber(statsDb, 'nodesCount', function (err) {
            cb(null, node);
          });
        } else {
          if (data) {
            node.data = data;
          }
          cb(null, node);
        }
      },
      function (node, cb) {
        vertexDb.put(nodeId, node, function (err) {
          cb(null, node);
        })
      }
    ], function (err, node) {
      if (callback) {
        return callback(null, node);
      } else {
        return node;
      }
    });
  };

  var createLink = function (fromId, toId, data, callback, linkId, fromNode, toNode) {

    var link = new coreObjects.Link(fromId, toId, data, linkId);

    //throw new Error(JSON.stringify(arguments));

    async.parallel([

        function (cb2) {
          edgeDb.put(linkId, link, cb2);
        },
        function (cb2) {
          incrNumber(statsDb, 'linksCount', cb2);
        },
        function (cb2) {
          fromNode.links.push(link);
          vertexDb.put(fromId, fromNode, cb2);
        },
        function (cb2) {
          toNode.links.push(link);
          vertexDb.put(toId, toNode, cb2);
        }
      ],
      function (err) {

        if (err)
          throw err;

        if (callback) {
          callback(null, link);
        } else {
          return link;
        }
      });
  }

  var addLink = function (fromId, toId, data, callback) {

    var linkId = fromId + linkConnectionSymbol + toId;

    var mainArguments = Array.prototype.slice.call(arguments);

    //throw new Error(JSON.stringify(mainArguments));
    //Add callback if not provided
    
    if (!callback){
      var fn = function(){};
      mainArguments.push(fn)
    }

    async.parallel({
      fromNode: function (next) {
        addNode(fromId, null, next);
      },
      toNode: function (next) {
        addNode(toId, null, next);
      },
      edgeCount: function (next) {

          async.waterfall([

            function (cb) {
              getNumber(multiEdgesDb, linkId, cb);
            },
            function (value, cb) {
              if (value == 0) {
                putNumber(multiEdgesDb, linkId, 1, cb);
              } else {
                incrNumber(multiEdgesDb, linkId, cb);
              }
            }
          ], function (err, value) {
            next(null, value);
          })

        }
        //,hasLink: function(next){
        //  hasLink(fromId, toId, next);
        //}
    }, function (err, results) {

      if (err)
        throw err;

      linkId = results.edgeCount == 1 ? linkId : (linkId += '@' + (results.edgeCount - 1));
      mainArguments.push(linkId);
      mainArguments.push(results.fromNode);
      mainArguments.push(results.toNode);

      //throw new Error(JSON.stringify(mainArguments));

      createLink.apply(this, mainArguments);

    });

  }

  var removeNode = function (nodeId, callback) {

    function next(err, node) {

      if (!node) {
        if (callback) {
          return callback(null, false);
        } else {
          return false;
        }
      }

      async.parallel([

        function (cb) {
          vertexDb.del(nodeId, cb);
        },
        function (cb) {
          decrNumber(statsDb, 'nodesCount', cb);
        },
        function (cb) {

          if (!node.links) {
            return cb();
          }

          async.each(node.links, function (link, cb1) {
            removeLink(link, cb1);
          }, function (err) {
            cb();
          });
        }
      ], function (err) {
        if (callback) {
          callback(null, true);
        } else {
          return true;
        }
      });
    }

    getNode(nodeId, next);
  };

  return {

    addNode: addNode,

    addLink: addLink,

    removeLink: removeLink,

    removeNode: removeNode,

    getNode: getNode,

    hasLink: hasLink,

    getNodesCount: function (callback) {
      //var callback = function(err,value){
      //  return value;
      //}
      getNumber(statsDb, 'nodesCount', callback);
    },

    getLinksCount: function (callback) {
      //var callback = function(err,value){
      //  return value;
      //}
      getNumber(statsDb, 'linksCount', callback);
    },

    getLinks: function (nodeId, callback) {

      var cb = function (err, node) {
        var v = node ? node.links : null;
        callback(null, v);
      }
      getNode(nodeId, cb);
    },

    forEachNode: function (callback) {
      if (typeof callback !== 'function') {
        return;
      }

      vertexDb.createReadStream()
        .on('data', function (data) {
          if (callback(data.value)) {
            this.destroy();
            return;
          }
        });

    },

    forEachLinkedNode: function (nodeId, callback, oriented) {

      var next = function (err, node) {

        var i,
          link,
          linkedNodeId;

        if (node && node.links && typeof callback === 'function') {

          if (oriented) {
            for (i = 0; i < node.links.length; ++i) {
              link = node.links[i];
              if (link.fromId === nodeId) {

                var cb = function (err, inNode) {
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

              var cb = function (err, linkedNode) {
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

    forEachLink: function (callback) {
      var i, length;
      if (typeof callback === 'function') {

        edgeDb.createReadStream()
          .on('data', function (data) {
            callback(data.value);
          });
      }
    },

    clear: function (callback) {

      async.parallel([

        function (cb) {
          dispose(vertexDb, cb);
        },
        function (cb) {
          statsDb.put('nodesCount', 0, cb);
        },
        function (cb) {
          dispose(edgeDb, cb);
        },
        function (cb) {
          statsDb.put('linksCount', 0, cb);
        },
        function (cb) {
          dispose(multiEdgesDb, cb);
        }
      ], function (err) {
        if (callback) {
          callback(null, true);
        } else {
          return true;
        }
      });
    }

  }

}