var lmdb = require('node-lmdb'),
  coreObjects = require('./core-objects');

module.exports = function(config) {

  //lmdb defaults
  var lmdbConfig = {

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
  var linkConnectionSymbol = '->';

  return {

    addNode: function(nodeId, data) {

      var node = this.getNode(nodeId);
      
      if (!node) {
          // TODO: Should I check for linkConnectionSymbol here?
          node = new coreObjects.Node(nodeId);
          //nodesCount++;
          lmdbWrap.incrNumber(vertexDb,'nodesCount');

          //recordNodeChange(node, 'add');
      } else {
          //recordNodeChange(node, 'update');
      }

      node.data = data;

      //nodes[nodeId] = node;
      lmdbWrap.putBinary(vertexDb, nodeId, node);

    },

    addLink: function (fromId, toId, data) {
      //enterModification();

      var fromNode = this.getNode(fromId) || this.addNode(fromId);
      var toNode = this.getNode(toId) || this.addNode(toId);

      var linkId = fromId.toString() + linkConnectionSymbol + toId.toString();
      //var isMultiEdge = multiEdges.hasOwnProperty(linkId);
      var isMultiEdge = lmdbWrap.getNumber(multiEdgesDb, linkId);
      if (isMultiEdge || this.hasLink(fromId, toId)) {
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
      lmdbWrap.incrNumber(edgeDb,'linksCount');

      // TODO: this is not cool. On large graphs potentially would consume more memory.
      fromNode.links.push(link);
      toNode.links.push(link);

      lmdbWrap.putBinary(vertexDb, fromId, fromNode);
      lmdbWrap.putBinary(vertexDb, toId, toNode);

      //recordLinkChange(link, 'add');

      //exitModification(this);

      return link;

    },

    removeLink: function (link) {
      if (!link) { return false; }
      //var idx = indexOfElementInArray(link, links);
      //if (idx < 0) { return false; }

      var e = lmdbWrap.getBinary(edgeDb, link.id);
      if (!e){return false;}
      //enterModification();

      //links.splice(idx, 1);
      lmdbWrap.delete(edgeDb, link.id);

      var fromNode = this.getNode(link.fromId);
      var toNode = this.getNode(link.toId);

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
    },

    removeNode: function (nodeId) {
      var node = this.getNode(nodeId);
      if (!node) { return false; }

      //enterModification();

      //while (node.links.length) {
      //    var link = node.links[0];
      //    this.removeLink(link);
      //}
      var self = this;
      for(var k in node.links) {
        var link = node.links[k];
        self.removeLink(link);
      }

      //delete nodes[nodeId];
      lmdbWrap.delete(vertexDb, nodeId);
      //nodesCount--;
      lmdbWrap.decrNumber(vertexDb, 'nodesCount');

      //recordNodeChange(node, 'remove');

      //exitModification(this);

      return true;
    },

    getNode : function (nodeId, callback) {
      return lmdbWrap.getBinary(vertexDb, nodeId);
      //return nodes[nodeId];
    },

    getNodesCount : function () {
      return lmdbWrap.getNumber(vertexDb, 'nodesCount');
      //return nodesCount;
    },

    getLinksCount : function () {
        return lmdbWrap.getNumber(edgeDb, 'linksCount');
        //return links.length;
    },

    getLinks : function (nodeId) {
      
      var node = this.getNode(nodeId);
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
      var node = this.getNode(nodeId),
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
                      var inNode = this.getNode(link.toId);
                      callback(inNode, link);
                  }
              }
          } else {
              for (i = 0; i < node.links.length; ++i) {
                  link = node.links[i];
                  linkedNodeId = link.fromId === nodeId ? link.toId : link.fromId;

                  //callback(nodes[linkedNodeId], link);
                  var linkedNode = this.getNode(linkedNodeId);
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

    hasLink: function (fromNodeId, toNodeId) {
      // TODO: Use adjacency matrix to speed up this operation.
      var node = this.getNode(fromNodeId),
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
    },

    clear: function () {
        var that = this;
        //that.beginUpdate();
        that.forEachNode(function (node) { 
          
          if (typeof node == 'object' && node.id){
            that.removeNode(node.id); 
          }
        });

        var txn = env.beginTxn();
        var cursor = new lmdb.Cursor(txn, vertexDb);
        for (var found = cursor.goToFirst(); found; found = cursor.goToNext()) {
            cursor.del();
        }
        cursor.close();
        txn.commit();


        //that.endUpdate();
    }

  }

}