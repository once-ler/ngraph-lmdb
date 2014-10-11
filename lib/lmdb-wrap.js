var lmdb = require('node-lmdb'),
  fs = require('fs'),
  lmdbConfig = require('./lmdb-config'),
  lmdbWrapHelper = require('./lmdb-wrap-helper'),
  lmdbIndex = require('./lmdb-index'),
  coreObjects = require('./core-objects');

module.exports = function(config) {

  //Merge incoming options
  lmdbConfig = coreObjects.mergeOptions(lmdbConfig, config);
  //setup data path
  if (!fs.existsSync(lmdbConfig.env.path)) {
    fs.mkdirSync(lmdbConfig.env.path, 0777);
  }

  //Private
  var indexVertexEngine = lmdbIndex();
  indexVertexEngine.init(lmdbWrapHelper.env, lmdbWrapHelper.indexVertexDb);
  var indexEdgeEngine = lmdbIndex();
  indexEdgeEngine.init(lmdbWrapHelper.env, lmdbWrapHelper.indexEdgeDb);

  var getNode = function(nodeId, callback) {
    return lmdbWrapHelper.getBinary(lmdbWrapHelper.vertexDb, nodeId);
  };

  var getLink = function(linkId, callback) {
    return lmdbWrapHelper.getBinary(lmdbWrapHelper.edgeDb, linkId);
  };

  var removeLinkIndex = function(link) {

    indexEdgeEngine.removeDocument(link);

  };

  function deleteLink(nodeId, direction) {

    if (direction.search(/^(in|out|both)$/i) == -1) {
      return false;
    }

    //Get the link ids
    var links = [];
    var txn = lmdbWrapHelper.env.beginTxn();
    var cursor = new lmdb.Cursor(txn, lmdbWrapHelper.edges[direction]);
    for (var found = (cursor.goToRange(nodeId) === nodeId); found; found = cursor.goToNextDup()) {
      cursor.getCurrentString(function(key, linkId) {
        links.push(linkId);
      });
    }
    cursor.close();
    txn.commit();

    //delete refs and actual links
    for (var k in links) {
      var linkId = links[k];
      var link = getLink(linkId);

      if (link) {

        if (direction == 'both') {
          lmdbWrapHelper.delete(lmdbWrapHelper.edgeDb, linkId);
        } else {
          var linkedNodeId = (direction == 'in' ? link.fromId : link.toId);
          var txn1 = lmdbWrapHelper.env.beginTxn();
          var cursor1 = new lmdb.Cursor(txn1, direction == 'in' ? lmdbWrapHelper.inEdgeDb :
            lmdbWrapHelper.outEdgeDb);
          var found1 = cursor1.goToDup(linkedNodeId, linkId);
          if (found1) {
            cursor1.del();
          }
          cursor1.close();
          txn1.commit();
        }

        //Remove index data related to this link
        removeLinkIndex(link);

      }
    }

  }

  var removeLink = function(nodeId) {

    if (!nodeId) {
      return false;
    }

    //Delete all link refs with out nodes related to this node
    deleteLink(nodeId, 'in');

    //Delete all link refs with in nodes related to this node
    deleteLink(nodeId, 'out');

    //Delete all actual links related to this node
    deleteLink(nodeId, 'both');

    //Delete links of itself
    if (lmdbWrapHelper.get(lmdbWrapHelper.bothEdgeDb, nodeId)) {
      lmdbWrapHelper.delete(lmdbWrapHelper.bothEdgeDb, nodeId);
    }
    if (lmdbWrapHelper.get(lmdbWrapHelper.inEdgeDb, nodeId)) {
      lmdbWrapHelper.delete(lmdbWrapHelper.inEdgeDb, nodeId);
    }
    if (lmdbWrapHelper.get(lmdbWrapHelper.outEdgeDb, nodeId)) {
      lmdbWrapHelper.delete(lmdbWrapHelper.outEdgeDb, nodeId);
    }
    return true;
  };

  var removeNodeIndex = function(node) {

    indexVertexEngine.removeDocument(node);

  };

  var removeNode = function(nodeId) {
    var node = getNode(nodeId);
    if (!node) {
      return false;
    }

    //Remove all links associated with this node
    removeLink(nodeId);

    //Remove all indexes associated with this node
    removeNodeIndex(node);

    lmdbWrapHelper.delete(lmdbWrapHelper.vertexDb, nodeId);
    lmdbWrapHelper.decrNumber(lmdbWrapHelper.statsDb, 'nodesCount');

    return true;
  }

  var hasLink = function(fromNodeId, toNodeId) {
    throw new Error('hasLink not implemented');
  };

  var addNode = function(nodeId, data) {

    var node = getNode(nodeId);

    if (!node) {
      node = new coreObjects.Node(nodeId);
      lmdbWrapHelper.incrNumber(lmdbWrapHelper.statsDb, 'nodesCount');
    }

    if (data) {
      node.data = data;
    }

    lmdbWrapHelper.putBinary(lmdbWrapHelper.vertexDb, nodeId, node);

    //Index vertex
    indexVertexEngine.addDocument(node);

    return node;

  };

  var addLink = function(fromId, toId, label, data) {

    //Create nodes if not exist
    var fromNode = addNode(fromId);
    var toNode = addNode(toId);

    //Create link keys
    var linkId = fromId + ':' + label + ':' + toId;

    //Is this MultiEdge?
    var isMultiEdge = lmdbWrapHelper.getNumber(lmdbWrapHelper.multiEdgesDb, linkId);
    if (!isMultiEdge) {
      lmdbWrapHelper.putNumber(lmdbWrapHelper.multiEdgesDb, linkId, 1);
    } else {
      lmdbWrapHelper.incrNumber(lmdbWrapHelper.multiEdgesDb, linkId);
      linkId += '@' + (isMultiEdge);
    }

    var link = new coreObjects.Link(fromId, toId, label, data, linkId);

    lmdbWrapHelper.putString(lmdbWrapHelper.bothEdgeDb, fromId, linkId);
    lmdbWrapHelper.putString(lmdbWrapHelper.bothEdgeDb, toId, linkId);
    lmdbWrapHelper.putString(lmdbWrapHelper.inEdgeDb, toId, linkId);
    lmdbWrapHelper.putString(lmdbWrapHelper.outEdgeDb, fromId, linkId);
    lmdbWrapHelper.putBinary(lmdbWrapHelper.edgeDb, linkId, link);

    lmdbWrapHelper.incrNumber(lmdbWrapHelper.statsDb, 'linksCount');

    //Index edge - in and out edges share the same data
    indexEdgeEngine.addDocument(link);

    return link;

  };

  var getLinks = function(nodeId, direction) {

    if (!nodeId) {
      return null;
    }

    var linkIds = [];
    var links = [];
    var txn = lmdbWrapHelper.env.beginTxn();
    var db = lmdbWrapHelper.edges[direction];
    var cursor = new lmdb.Cursor(txn, db ? db : bothEdgeDb);

    for (var found = (cursor.goToRange(nodeId) === nodeId); found; found = cursor.goToNextDup()) {
      cursor.getCurrentString(function(key, s) {
        linkIds.push(s);
      });
    }
    cursor.close();
    txn.abort();

    //Can't do a getString inside of the cursor
    for (var k in linkIds) {
      var link = getLink(linkIds[k]);

      if (link) {
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

    getNode: getNode,

    getNodesCount: function() {
      return lmdbWrapHelper.getNumber(lmdbWrapHelper.statsDb, 'nodesCount');
    },

    getLinksCount: function() {
      return lmdbWrapHelper.getNumber(lmdbWrapHelper.statsDb, 'linksCount');
    },

    getLinks: getLinks,

    forEachNode: function(callback) {
      if (typeof callback !== 'function') {
        return;
      }

      var txn = lmdbWrapHelper.env.beginTxn();
      var cursor = new lmdb.Cursor(txn, lmdbWrapHelper.vertexDb);
      for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
        cursor.getCurrentBinary(function(key, buffer) {
          var d = buffer.toString();
          try {
            d = JSON.parse(d);
          } catch (e) {
            //no op
          }
          if (callback(d)) {
            cursor.close();
            txn.commit();
            return;
          }
        });
      }
      cursor.close();
      txn.commit();

    },

    searchForNodeDocuments: function(str, callback) {

      if (typeof str !== 'string') {
        return;
      }

      var results = indexVertexEngine.searchForDocuments(str);

      if (callback) {
        return callback(null, results);
      }

      return results;

    },

    /**
    * !!Using this as a test!!
    */
    forEachNodeIndex: function(callback) {
      if (typeof callback !== 'function') {
        return;
      }

      var txn = lmdbWrapHelper.env.beginTxn();
      var cursor = new lmdb.Cursor(txn, lmdbWrapHelper.indexVertexDb);
      for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
        cursor.getCurrentString(function(key, value) {
          callback({
            key: key,
            value: value
          });
        });
      }
      cursor.close();
      txn.commit();
    },

    forEachLinkedNode: function(nodeId, callback, oriented) {
      throw new Error('forEachLinkedNode not implemented');
    },

    forEachLink: function(callback) {
      var i, length;
      if (typeof callback === 'function') {
        /*
          for (i = 0, length = links.length; i < length; ++i) {
              callback(links[i]);
          }
          */
        var txn = lmdbWrapHelper.env.beginTxn();
        var cursor = new lmdb.Cursor(txn, lmdbWrapHelper.edgeDb);
        for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
          cursor.getCurrentBinary(function(key, buffer) {
            var d = buffer.toString();
            try {
              d = JSON.parse(d);
            } catch (e) {
              //no op
            }
            callback(d);
          });
        }
        cursor.close();
        txn.commit();

      }
    },

    /**
    * !!Using this as a test!!
    */
    forEachOutLink: function(callback) {
      var i, length;
      if (typeof callback === 'function') {

        var txn = lmdbWrapHelper.env.beginTxn();
        var cursor = new lmdb.Cursor(txn, lmdbWrapHelper.outEdgeDb);
        for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
          cursor.getCurrentString(function(key, val) {
            callback({
              key: key,
              value: val
            });
          });
        }
        cursor.close();
        txn.commit();
      }
    },

    hasLink: hasLink,

    clear: function() {

      //Should this be here or in helper?

      lmdbWrapHelper.vertexDb.drop();
      lmdbWrapHelper.env.openDbi(lmdbConfig.vertexDb)

      lmdbWrapHelper.edgeDb.drop();
      lmdbWrapHelper.env.openDbi(lmdbConfig.edgeDb);

      lmdbWrapHelper.bothEdgeDb.drop();
      lmdbWrapHelper.env.openDbi(lmdbConfig.bothEdgeDb);

      lmdbWrapHelper.inEdgeDb.drop();
      lmdbWrapHelper.env.openDbi(lmdbConfig.inEdgeDb);

      lmdbWrapHelper.outEdgeDb.drop();
      lmdbWrapHelper.env.openDbi(lmdbConfig.outEdgeDb);

      lmdbWrapHelper.multiEdgesDb.drop();
      lmdbWrapHelper.env.openDbi(lmdbConfig.multiEdgesDb);

      lmdbWrapHelper.indexVertexDb.drop();
      lmdbWrapHelper.env.openDbi(lmdbConfig.indexVertexDb);

      lmdbWrapHelper.indexEdgeDb.drop();
      lmdbWrapHelper.env.openDbi(lmdbConfig.indexEdgeDb);

      lmdbWrapHelper.putNumber(lmdbWrapHelper.statsDb, 'nodesCount', 0);
      lmdbWrapHelper.putNumber(lmdbWrapHelper.statsDb, 'linksCount', 0);

    }

  }

}
