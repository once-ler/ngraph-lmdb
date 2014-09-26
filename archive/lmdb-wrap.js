var lmdb = require('lmdb'),
  async = require('async'),
  coreObjects = require('./core-objects');

module.exports = function(config) {

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

  //mapSize: 10485760 default
  var vertexDb = lmdb(path + '/vertices', {
    createIfMissing: true,
    sync: false,
    writeMap: true,
    metaSync: false,
    mapAsync: true,
    mapSize: 2 * 1024 * 1024 * 1024
  });
  vertexDb.open(function(err) {
    if (err)
      throw err;
  });

  var edgeDb = lmdb(path + '/edges', {
    createIfMissing: true,
    sync: false,
    writeMap: true,
    metaSync: false,
    mapAsync: true,
    mapSize: 2 * 1024 * 1024 * 1024
  });
  edgeDb.open(function(err) {
    if (err)
      throw err;
  });

  var multiEdgesDb = lmdb(path + '/multi-edges', {
    createIfMissing: true
  });
  multiEdgesDb.open(function(err) {
    if (err)
      throw err;
  });

  var statsDb = lmdb(path + '/stats', {
    createIfMissing: true
  });
  statsDb.open(function(err) {
    if (err)
      throw err;
  });

  var linkConnectionSymbol = '->';

  var dispose = function(db, callback) {

    var it = db.iterator({
        keyAsBuffer: false,
        valueAsBuffer: false
      }),
      fn = function(err, key, data) {

        if (key && data) {
          db.del(key, function(err) {
            process.nextTick(moveNext);
          });
        } else {
          callback(null, true)
          it.end(function() {})
        }
      },
      moveNext = function() {
        it.next(fn);
      };

    moveNext();
  };

  var getNumber = function(dbi, key, callback) {
    dbi.get(key, {
      asBuffer: false
    }, function(err, value) {
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

  var putJSON = function(dbi, key, value, callback) {

    callback = callback || function() {};

    var r = value || {};
    try {
      r = JSON.stringify(value);
    } catch (e) {
      //no op
    }

    dbi.put(key, r, function(err) {
      if (err) {
        throw err;
      }
      callback(null, value);
    })
  };

  var putNumber = function(dbi, key, value, callback) {
    callback = callback || function() {};

    dbi.put(key, value + '', function(err) {
      if (err) {
        return callback(null, 0);
      }
      callback(null, +value);
    })
  };

  var incrNumber = function(dbi, key, callback) {

    callback = callback || function() {};

    async.waterfall([

      function(next) {
        getNumber(dbi, key, next);
      },
      function(value, next) {
        putNumber(dbi, key, ++value, next);
      }
    ], function(err, value) {
      callback(null, +value);
    });

  };

  var decrNumber = function(dbi, key, callback) {

    callback = callback || function() {};

    async.waterfall([

      function(next) {
        getNumber(dbi, key, next);
      },
      function(value, next) {
        if (+value > 0) {
          putNumber(dbi, key, --value, next);
        } else {
          next(null, value);
        }
      }
    ], function(err, value) {
      callback(null, +value);
    });

  };

  var getNode = function(nodeId, callback) {

    callback = callback || function() {};

    vertexDb.get(nodeId, {
      asBuffer: false
    }, function(err, value) {
      if (err) {
        return callback(null, null);
      }
      var retval = value;
      try {
        retval = JSON.parse(value);
      } catch (e) {
        //no op
      }
      callback(null, retval);
    });
  };

  var getLink = function(edgeId, callback) {

    callback = callback || function() {};

    edgeDb.get(edgeId, {
      asBuffer: false
    }, function(err, value) {
      if (err) {
        return callback(null, null);
      }
      var retval = value;
      try {
        retval = JSON.parse(value);
      } catch (e) {
        //no op
      }
      callback(null, retval);
    });
  };

  var removeLink = function(link, callback) {

    callback = callback || function() {};

    if (!link) {
      return callback(null, false);
    }

    async.waterfall([

      function(cb) {
        getLink(link.id, cb);
      },
      function(link, cb) {
        if (!link) {
          cb('link is null');
        } else {
          cb(null, link);
        }
      },
      function(link, cb) {
        async.parallel([

          function(cb1) {
            edgeDb.del(link.id, cb1);
          },
          function(cb1) {
            decrNumber(statsDb, 'linksCount', cb1)
          }
        ], function(err) {
          next(cb, link);
        });
      },
      function(link, cb) {

        async.each([link.fromId, link.toId],
          function(id, cb1) {

            var callback = function(err, node) {

              if (node) {
                idx = coreObjects.indexOfElementInArray(link, node.links);
                if (idx >= 0) {
                  node.links.splice(idx, 1);
                  //Update node
                  putJSON(vertexDb, nodeId, data, cb1);
                  //vertexDb.put(nodeId, JSON.stringify(data), cb1);
                } else {
                  cb1();
                }
              } else {
                cb1();
              }

            };

            getNode(id, callback);

          }, function(err) {
            cb(null, link);
          });

      }
    ], function(err, results) {
      if (err)
        callback(null, false);
      else
        callback(null, true);
    });
  };

  var hasLink = function(fromNodeId, toNodeId, callback) {

    callback = callback || function() {};

    var next = function(err, node) {

      //No node
      if (!node) {
        return callback(null, null);
      }

      //Node and link exists
      var i;
      for (i = 0; i < node.links.length; ++i) {
        var link = node.links[i];
        if (link.fromId === fromNodeId && link.toId === toNodeId) {

          //Link exists!
          return callback(null, link);
        }
      }

      //No link
      return callback(null, null);

    };

    getNode(fromNodeId, next);

  };

  var addNode = function(nodeId, data, callback) {

    callback = callback || function() {};

    async.waterfall([

      function(cb) {
        getNode(nodeId, cb);
      },
      function(node, cb) {
        if (!node) {
          node = new coreObjects.Node(nodeId);
          node.data = data ? data : {};
          //incrNumber(statsDb, 'nodesCount', function (err) {
          //  cb(null, node);
          //});
          cb(null, node);
        } else {
          node.data = data || {};
          cb(null, node);
        }
      },
      function(node, cb) {

        //putJSON(vertexDb, nodeId, node, cb); 
        vertexDb.put(nodeId, JSON.stringify(node), function(err) {
          if (err) {
            throw err;
          }
          cb(null, node);
        })

      }
    ], function(err, node) {
      return callback(null, node);
    });
  };

  var createLink = function(fromId, toId, data, callback, linkId, fromNode, toNode) {

    var link = new coreObjects.Link(fromId, toId, data, linkId);

    async.parallel([

        function(cb2) {
          putJSON(edgeDb, linkId, link, cb2);
        },
        function(cb2) {
          incrNumber(statsDb, 'linksCount', cb2);
        },
        function(cb2) {
          fromNode.links.push(link);
          putJSON(vertexDb, fromId, fromNode, cb2);
        },
        function(cb2) {
          toNode.links.push(link);
          putJSON(vertexDb, toId, toNode, cb2);
        }
      ],
      function(err) {

        if (err)
          throw err;

        if (callback) {
          callback(null, link);
        } else {
          return link;
        }
      });
  }

  var addLink = function(fromId, toId, data, callback) {

    var linkId = fromId + linkConnectionSymbol + toId;

    var mainArguments = Array.prototype.slice.call(arguments);

    if (!callback) {
      var fn = function() {};
      mainArguments.push(fn)
    }

    async.parallel({
      fromNode: function(next) {
        addNode(fromId, null, next);
      },
      toNode: function(next) {
        addNode(toId, null, next);
      },
      edgeCount: function(next) {

        async.waterfall([

          function(cb) {
            getNumber(multiEdgesDb, linkId, cb);
          },
          function(value, cb) {
            if (value == 0) {
              putNumber(multiEdgesDb, linkId, 1, cb);
            } else {
              incrNumber(multiEdgesDb, linkId, cb);
            }
          }
        ], function(err, value) {
          next(null, value);
        })

      }
    }, function(err, results) {

      if (err)
        throw err;

      linkId = results.edgeCount == 1 ? linkId : (linkId += '@' + (results.edgeCount - 1));
      mainArguments.push(linkId);
      mainArguments.push(results.fromNode);
      mainArguments.push(results.toNode);

      createLink.apply(this, mainArguments);

    });

  }

  var removeNode = function(nodeId, callback) {

    callback = callback || function() {};

    function next(err, node) {

      if (!node) {
        return callback(null, false);
      }

      async.parallel([

        function(cb) {
          vertexDb.del(nodeId, cb);
        },
        function(cb) {
          decrNumber(statsDb, 'nodesCount', cb);
        },
        function(cb) {

          if (!node.links) {
            return cb();
          }

          async.each(node.links, function(link, cb1) {
            removeLink(link, cb1);
          }, function(err) {
            cb();
          });
        }
      ], function(err) {
        callback(null, true);
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

    getNodesCount: function(callback) {
      callback = callback || function() {};
      getNumber(statsDb, 'nodesCount', callback);
    },

    getLinksCount: function(callback) {
      callback = callback || function() {};
      getNumber(statsDb, 'linksCount', callback);
    },

    getLinks: function(nodeId, callback) {
      callback = callback || function() {};
      var cb = function(err, node) {
        var v = node ? node.links : null;
        callback(null, v);
      }
      getNode(nodeId, cb);
    },

    forEachNode: function(callback) {
      if (typeof callback !== 'function') {
        return;
      }

      var it = vertexDb.iterator({
          keyAsBuffer: false,
          valueAsBuffer: false
        }),
        fn = function(err, key, data) {

          if (key && data) {
            var r = data;
            try {
              r = JSON.parse(data);
            } catch (e) {}

            if (callback(r)) {
              it.end(function() {});
            } else {
              process.nextTick(moveNext);
            }
          } else {
            it.end(function() {});
          }
        },
        moveNext = function() {
          it.next(fn);
        };

      moveNext();

    },

    forEachLinkedNode: function(nodeId, callback, oriented) {

      callback = callback || function() {};

      var next = function(err, node) {

        var i,
          link,
          linkedNodeId;

        if (node && node.links && typeof callback === 'function') {

          if (oriented) {
            for (i = 0; i < node.links.length; ++i) {
              link = node.links[i];
              if (link.fromId === nodeId) {

                var cb = function(err, inNode) {
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

              var cb = function(err, linkedNode) {
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

    forEachLink: function(callback) {

      if (typeof callback === 'function') {

        var it = edgeDb.iterator({
            keyAsBuffer: false,
            valueAsBuffer: false
          }),
          fn = function(err, key, data) {

            if (key && data) {
              var r = data;
              try {
                r = JSON.parse(data);
              } catch (e) {}

              callback(r);
              process.nextTick(moveNext);
            } else {
              it.end(function() {})
            }
          },
          moveNext = function() {
            it.next(fn);
          };

        moveNext();

      }
    },

    clear: function(callback) {

      callback = callback || function() {};

      async.parallel([

        function(cb) {
          dispose(vertexDb, cb);
        },
        function(cb) {
          statsDb.put('nodesCount', '0', cb);
        },
        function(cb) {
          dispose(edgeDb, cb);
        },
        function(cb) {
          statsDb.put('linksCount', '0', cb);
        },
        function(cb) {
          dispose(multiEdgesDb, cb);
        }
      ], function(err) {
        if (callback) {
          callback(null, true);
        } else {
          return true;
        }
      });
    }

  }

}
