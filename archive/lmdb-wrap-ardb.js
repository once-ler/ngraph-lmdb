var redis = require('redis'),
  db = redis.createClient(6379, '127.0.0.1', {
    no_ready_check: true
  }),
  async = require('async'),
  coreObjects = require('./core-objects');

module.exports = function(config) {

  var linkConnectionSymbol = '->';

  var getNumber = function(key, callback) {
    db.get(key, function(err, value) {
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

  var putNumber = function(key, value, callback) {
    db.set(key, value, function(err) {
      if (callback) {
        callback(null, +value);
      } else {
        return +value;
      }
    })
  };

  var incrNumber = function(key, callback) {

    async.waterfall([

      function(next) {
        getNumber(key, next);
      },
      function(value, next) {
        //putNumber(key, ++value, next);
        db.incr(key, next);
      }
    ], function(err, value) {
      if (callback) {
        callback(null, +value);
      } else {
        return +value;
      }
    });

  };

  var decrNumber = function(key, callback) {

    async.waterfall([

      function(next) {
        getNumber(key, next);
      },
      function(value, next) {
        if (+value > 0) {
          //putNumber(dbi, key, --value, next);
          db.decr(key, next);
        } else {
          next(null, value);
        }
      }
    ], function(err, value) {
      if (callback) {
        callback(null, +value);
      } else {
        return +value;
      }
    });

  };

  var getNode = function(nodeId, callback) {

    db.get(nodeId, function(err, value) {
      if (err) {

        if (callback)
          return callback(null, null);
        else
          return null;
      }

      value = JSON.parse(value);
      if (callback) {
        callback(null, value);
      } else {
        return value;
      }
    });
  };

  var getLink = function(edgeId, callback) {

    db.get(edgeId, function(err, value) {
      if (err) {
        if (callback)
          return callback(null, null);
        else
          return null;
      }

      value = JSON.parse(value);
      if (callback) {
        callback(null, value);
      } else {
        return value;
      }
    });
  };

  var removeLink = function(link, callback) {

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

            db.mulit()
              .del(link.id)
              .srem('edges', link.id)
              .exec(function(err) {
                cb1();
              });

          },
          function(cb1) {
            decrNumber('linksCount', cb1)
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
                  //vertexDb.put(nodeId, data, cb1);
                  addNode(nodeId, data, cb1);
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

    var next = function(err, node) {

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

  var addNode = function(nodeId, data, callback) {

    async.waterfall([

      function(cb) {
        getNode(nodeId, cb);
      },
      function(node, cb) {
        if (!node) {
          node = new coreObjects.Node(nodeId);
          node.data = data ? data : {};
          incrNumber('nodesCount', function(err) {
            cb(null, node);
          });
        } else {
          if (data) {
            node.data = data;
          }
          cb(null, node);
        }
      },
      function(node, cb) {

        db.multi()
          .set(nodeId, JSON.stringify(node))
          .sadd('nodes', nodeId)
          .exec(function(err) {
            cb(null, node);
          });
      }
    ], function(err, node) {
      if (callback) {
        return callback(null, node);
      } else {
        return node;
      }
    });
  };

  var putLink = function(linkId, link, callback) {
    db.multi()
      .set(linkId, JSON.stringify(link))
      .sadd('edges', linkId)
      .exec(function(err) {
        if (callback) {
          callback(null, link);
        } else {
          return link;
        }
      });
  }

  var createLink = function(fromId, toId, data, callback, linkId, fromNode, toNode) {

    var link = new coreObjects.Link(fromId, toId, data, linkId);

    if (!toNode) {
      throw new Error(JSON.stringify(arguments));
    }

    async.parallel([

        function(cb2) {
          putLink(linkId, link, cb2);
        },
        function(cb2) {
          incrNumber('linksCount', cb2);
        },
        function(cb2) {
          fromNode.links.push(link);
          addNode(fromId, fromNode, cb2);
        },
        function(cb2) {
          toNode.links.push(link);
          addNode(toId, toNode, cb2);
        }
      ],
      function(err) {
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

    //Add callback if not provided
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
            getNumber(linkId, cb);
          },
          function(value, cb) {
            if (value == 0) {
              putNumber(linkId, 1, cb);
            } else {
              incrNumber(linkId, cb);
            }
          }
        ], function(err, value) {
          next(null, value);
        })

      }
      //,hasLink: function(next){
      //  hasLink(fromId, toId, next);
      //}
    }, function(err, results) {

      if (!results.toNode) {
        throw new Error(JSON.stringify(results));
      }

      linkId = results.edgeCount == 1 ? linkId : (linkId += '@' + (results.edgeCount - 1));
      mainArguments.push(linkId);
      mainArguments.push(results.fromNode);
      mainArguments.push(results.toNode);

      //throw new Error(JSON.stringify(mainArguments));

      createLink.apply(this, mainArguments);

    });

  }

  var removeNode = function(nodeId, callback) {

    function next(err, node) {

      if (!node) {
        if (callback) {
          return callback(null, false);
        } else {
          return false;
        }
      }

      async.parallel([

        function(cb) {
          db.mulit()
            .del(link.id)
            .srem('nodes', nodeId)
            .exec(function(err) {
              cb();
            });
        },
        function(cb) {
          decrNumber('nodesCount', cb);
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

    getNodesCount: function(callback) {
      //var callback = function(err,value){
      //  return value;
      //}
      getNumber('nodesCount', callback);
    },

    getLinksCount: function(callback) {
      //var callback = function(err,value){
      //  return value;
      //}
      getNumber('linksCount', callback);
    },

    getLinks: function(nodeId, callback) {

      var cb = function(err, node) {
        var v = node ? node.links : null;
        callback(null, v);
      }
      getNode(nodeId, cb);
    },

    forEachNode: function(callback) {
      if (typeof callback !== 'function') {
        if (callback) {
          callback(null, null);
        } else {
          return null;
        }
      }

      db.smembers('nodes', function(err, arr) {

        async.eachSeries(arr, function(nodeId, next) {

          getNode(nodeId, function(err, node) {
            if (callback(node)) {
              return;
            } else {
              next(null, node);
            }
          });
        });

      });
    },

    forEachLinkedNode: function(nodeId, callback, oriented) {

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
            }
          }
        }

      }

      getNode(nodeId, next);

    },

    forEachLink: function(callback) {
      var i, length;
      if (typeof callback === 'function') {

        db.smembers('edges', function(err, arr) {

          async.eachSeries(arr, function(edgeId, next) {

            getNode(edgeId, function(err, edge) {
              callback(edge);
              next(null, edge);
            });
          });

        });

      }
    },

    clear: function(callback) {

      db.flushdb(function(err) {
        if (callback) {
          callback(null, true);
        } else {
          return true;
        }
      });
    }

  }

}
