function merge_options(obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

module.exports = function(config) {

  var lmdb = require('node-lmdb');
  var ngraph = require('ngraph.graph')();

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

    historyDb: {
        name: "test:changes",
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
            r = buffer.toString();
        }
        return r;
    },
    getNumber: function(dbi, key){
        var txn = env.beginTxn();
        var n = txn.getNumber(dbi, key);
        txn.commit();
        return n ? n : null;
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
  lmdbConfig = merge_options(lmdbConfig, config);
  var env = new lmdb.Env();
  env.open(lmdbConfig.env);
  var vertexDb = env.openDbi(lmdbConfig.vertexDb);
  var edgeDb = env.openDbi(lmdbConfig.edgeDb);
  var historyDb = env.openDbi(lmdbConfig.historyDb);
  var multiEdgesDb = env.openDbi(lmdbConfig.multiEdgesDb);

  //Override methods
  /**
   * Adds node to the graph. If node with given id already exists in the graph
   * its data is extended with whatever comes in 'data' argument.
   *
   * @param nodeId the node's identifier. A string or number is preferred.
   *   note: Node id should not contain 'linkConnectionSymbol'. This will break link identifiers
   * @param [data] additional data for the node being added. If node already
   *   exists its data object is augmented with the new one.
   *
   * @return {node} The newly added node or node with given id if it already exists.
   */
  addNode : function (nodeId, data) {
      if (typeof nodeId === 'undefined') {
          throw new Error('Invalid node identifier');
      }

      //enterModification();
      
      var node = this.getNode(nodeId);
      
      if (!node) {
          // TODO: Should I check for linkConnectionSymbol here?
          node = new Node(nodeId);
          //nodesCount++;
          lmdbWrap.incrNumber(vertexDb,'nodesCount');

          //recordNodeChange(node, 'add');
      } else {
          //recordNodeChange(node, 'update');
      }

      node.data = data;

      //nodes[nodeId] = node;
      lmdbWrap.putBinary(vertexDb, nodeId, node);

      //exitModification(this);
      return node;
                  
  },

  /**
   * Adds a link to the graph. The function always create a new
   * link between two nodes. If one of the nodes does not exists
   * a new node is created.
   *
   * @param fromId link start node id;
   * @param toId link end node id;
   * @param [data] additional data to be set on the new link;
   *
   * @return {link} The newly created link
   */
  addLink : function (fromId, toId, data) {
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

      var link = new Link(fromId, toId, data, linkId);

      //links.push(link);
      lmdbWrap.putBinary(edgeDb, linkId, link);

      // TODO: this is not cool. On large graphs potentially would consume more memory.
      fromNode.links.push(link);
      toNode.links.push(link);

      lmdbWrap.putBinary(vertexDb, fromId, fromNode);
      lmdbWrap.putBinary(vertexDb, toId, toNode);

      //recordLinkChange(link, 'add');

      //exitModification(this);

      return link;

  },

  /**
   * Removes link from the graph. If link does not exist does nothing.
   *
   * @param link - object returned by addLink() or getLinks() methods.
   *
   * @returns true if link was removed; false otherwise.
   */
  removeLink : function (link) {
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
          idx = indexOfElementInArray(link, fromNode.links);
          if (idx >= 0) {
              fromNode.links.splice(idx, 1);
          }
      }

      if (toNode) {
          idx = indexOfElementInArray(link, toNode.links);
          if (idx >= 0) {
              toNode.links.splice(idx, 1);
          }
      }

      //recordLinkChange(link, 'remove');

      //exitModification(this);

      return true;
  },

  /**
   * Removes node with given id from the graph. If node does not exist in the graph
   * does nothing.
   *
   * @param nodeId node's identifier passed to addNode() function.
   *
   * @returns true if node was removed; false otherwise.
   */
  removeNode: function (nodeId) {
      var node = this.getNode(nodeId);
      if (!node) { return false; }

      //enterModification();

      while (node.links.length) {
          var link = node.links[0];
          this.removeLink(link);
      }

      //delete nodes[nodeId];
      lmdbWrap.delete(vertexDb, nodeId);
      //nodesCount--;
      lmdbWrap.decrNumber(vertexDb, 'nodesCount');

      //recordNodeChange(node, 'remove');

      //exitModification(this);

      return true;
  },

  /**
   * Gets node with given identifier. If node does not exist undefined value is returned.
   *
   * @param nodeId requested node identifier;
   *
   * @return {node} in with requested identifier or undefined if no such node exists.
   */
  getNode : function (nodeId, callback) {
      return lmdbWrap.getBinary(vertexDb, nodeId);
      //return nodes[nodeId];
  },

  /**
   * Gets number of nodes in this graph.
   *
   * @return number of nodes in the graph.
   */
  getNodesCount : function () {
      return lmdbWrap.getNumber(vertexDb, 'nodesCount');
      //return nodesCount;
  },

  /**
   * Gets total number of links in the graph.
   */
  getLinksCount : function () {
      return lmdbWrap.getNumber(edgeDb, 'linksCount');
      //return links.length;
  },

  /**
   * Gets all links (inbound and outbound) from the node with given id.
   * If node with given id is not found null is returned.
   *
   * @param nodeId requested node identifier.
   *
   * @return Array of links from and to requested node if such node exists;
   *   otherwise null is returned.
   */
  getLinks : function (nodeId) {
      
      var node = this.getNode(nodeId);
      return node ? node.links : null;            
  },

  /**
   * Invokes callback on each node of the graph.
   *
   * @param {Function(node)} callback Function to be invoked. The function
   *   is passed one argument: visited node.
   */
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
              var d = JSON.parse(buffer.toString());
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

  /**
   * Invokes callback on every linked (adjacent) node to the given one.
   *
   * @param nodeId Identifier of the requested node.
   * @param {Function(node, link)} callback Function to be called on all linked nodes.
   *   The function is passed two parameters: adjacent node and link object itself.
   * @param oriented if true graph treated as oriented.
   */
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
                      callback(nodes[link.toId], link);
                  }
              }
          } else {
              for (i = 0; i < node.links.length; ++i) {
                  link = node.links[i];
                  linkedNodeId = link.fromId === nodeId ? link.toId : link.fromId;

                  callback(nodes[linkedNodeId], link);
              }
          }
      }
  },

  /**
   * Enumerates all links in the graph
   *
   * @param {Function(link)} callback Function to be called on all links in the graph.
   *   The function is passed one parameter: graph's link object.
   *
   * Link object contains at least the following fields:
   *  fromId - node id where link starts;
   *  toId - node id where link ends,
   *  data - additional data passed to graph.addLink() method.
   */
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
                  var d = JSON.parse(buffer.toString());
                  callback(d);
              });
          }
          cursor.close();
          txn.commit();

      }
  },

  /**
   * Suspend all notifications about graph changes until
   * endUpdate is called.
   */
  beginUpdate : function () {
      //enterModification();
  },

  /**
   * Resumes all notifications about graph changes and fires
   * graph 'changed' event in case there are any pending changes.
   */
  endUpdate : function () {
      //exitModification(this);
  },

  /**
   * Removes all nodes and links from the graph.
   */
  clear : function () {
      var that = this;
      //that.beginUpdate();
      that.forEachNode(function (node) { that.removeNode(node.id); });
      //that.endUpdate();
  },

  /**
   * Detects whether there is a link between two nodes.
   * Operation complexity is O(n) where n - number of links of a node.
   *
   * @returns link if there is one. null otherwise.
   */
  hasLink : function (fromNodeId, toNodeId) {
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
  }


}
