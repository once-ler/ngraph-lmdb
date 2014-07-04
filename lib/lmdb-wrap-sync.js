var lmdb = require('node-lmdb'),
  coreObjects = require('./core-objects');
  
modules.exports = function(config) {

  //lmdb defaults
  var lmdbConfig = {

    appendOnly: false,

    env: {
        path: process.cwd() + "/mydata",
        mapSize: 2*1024*1024*1024, // maximum database size
        maxDbs: 10
    },

    vertexDb: {
        name: "test:vertices",
        create: true // will create if database did not exist
    },

    edgeDb: {
        name: "test:edges",
        create: true // will create if database did not exist
    },

    statsDb: {
        name: "test:stats",
        create: true // will create if database did not exist
    },

    multiEdgesDb: {
        name: "test:multi-edges",
        create: true // will create if database did not exist
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
    },
    delete: function(dbi, key){
        var txn = env.beginTxn();
        txn.del(dbi, key);
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
  var multiEdgesDb = env.openDbi(lmdbConfig.multiEdgesDb);
  var statsDb = env.openDbi(lmdbConfig.statsDb);
  var linkConnectionSymbol = '->';

  //Private
  var dispose = function(dbi) {

    var txn = env.beginTxn();
    var cursor = new lmdb.Cursor(txn, dbi);
    for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
        cursor.del();
    }
    cursor.close();
    txn.commit();
  };

  var getNode = function (nodeId, callback) {
    return lmdbWrap.getBinary(vertexDb, nodeId);
    //return nodes[nodeId];
  };

  var removeLink = function (link) {

    if (!link) { return false; }
    //var idx = indexOfElementInArray(link, links);
    //if (idx < 0) { return false; }

    var e = lmdbWrap.getBinary(edgeDb, link.id);
    if (!e){return false;}
    //enterModification();

    //links.splice(idx, 1);
    lmdbWrap.delete(edgeDb, link.id);
    lmdbWrap.decrNumber(statsDb,'linksCount');

    var fromNode = getNode(link.fromId);
    var toNode = getNode(link.toId);

    if (fromNode) {
      idx = coreObjects.indexOfElementInArray(link, fromNode.links);
      if (idx >= 0) {
          fromNode.links.splice(idx, 1);
      }
    }

    if (toNode) {
      idx = coreObjects.indexOfElementInArray(link, toNode.links);
      if (idx >= 0) {
          toNode.links.splice(idx, 1);
      }
    }

    //recordLinkChange(link, 'remove');

    //exitModification(this);

    return true;
  };

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
        // TODO: Should I check for linkConnectionSymbol here?
        node = new coreObjects.Node(nodeId);
        //nodesCount++;
        lmdbWrap.incrNumber(statsDb,'nodesCount');

        //recordNodeChange(node, 'add');
    } else {
        //recordNodeChange(node, 'update');
    }

    node.data = data;

    //nodes[nodeId] = node;
    lmdbWrap.putBinary(vertexDb, nodeId, node);

    return node;

  };

  return {

    addNode: addNode,

    addLink: function (fromId, toId, data) {
      //enterModification();

      var fromNode = getNode(fromId) || addNode(fromId);
      var toNode = getNode(toId) || addNode(toId);

      var linkId = fromId.toString() + linkConnectionSymbol + toId.toString();
      //var isMultiEdge = multiEdges.hasOwnProperty(linkId);
      var isMultiEdge = lmdbWrap.getNumber(multiEdgesDb, linkId);
      if (isMultiEdge || hasLink(fromId, toId)) {
          if (!isMultiEdge) {
              //multiEdges[linkId] = 0;
              lmdbWrap.putNumber(multiEdgesDb, linkId, 0);                    
          }
          //linkId += '@' + (++multiEdges[linkId]);

          lmdbWrap.incrNumber(multiEdgesDb,linkId);
          linkId += '@' + (lmdbWrap.getNumber(multiEdgesDb, linkId));
      }

      var link = new coreObjects.Link(fromId, toId, data, linkId);

      //links.push(link);
      lmdbWrap.putBinary(edgeDb, linkId, link);
      lmdbWrap.incrNumber(statsDb,'linksCount');

      // TODO: this is not cool. On large graphs potentially would consume more memory.
      fromNode.links.push(link);
      toNode.links.push(link);

      lmdbWrap.putBinary(vertexDb, fromId, fromNode);
      lmdbWrap.putBinary(vertexDb, toId, toNode);

      //recordLinkChange(link, 'add');

      //exitModification(this);

      return link;

    },

    removeLink: removeLink,

    removeNode: function (nodeId) {
      var node = getNode(nodeId);
      if (!node) { return false; }

      //enterModification();

      //while (node.links.length) {
      //    var link = node.links[0];
      //    this.removeLink(link);
      //}
      for(var k in node.links) {
        var link = node.links[k];
        removeLink(link);
      }

      //delete nodes[nodeId];
      lmdbWrap.delete(vertexDb, nodeId);
      //nodesCount--;
      lmdbWrap.decrNumber(statsDb, 'nodesCount');

      //recordNodeChange(node, 'remove');

      //exitModification(this);

      return true;
    },

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
      /*
      var node;

      for (node in nodes) {
          if (callback(nodes[node])) {
              return; // client doesn't want to proceed. return.
          }
      }
      */
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
        //that.beginUpdate();
        
        dispose(vertexDb);
        lmdbWrap.putNumber(statsDb, 'nodesCount', 0);
        dispose(edgeDb);
        lmdbWrap.putNumber(statsDb, 'linksCount', 0);
        dispose(multiEdgesDb);

        //that.endUpdate();
    }

  }

}