module.exports = function(config) {

  var ngraph = require('ngraph.graph')();
  var coreObjects = require('./lib/core-objects');
  var lmdbWrap = require('./lib/lmdb-wrap')(config);  

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
  ngraph.addNode = function (nodeId, data) {
      if (typeof nodeId === 'undefined') {
          throw new Error('Invalid node identifier');
      }

      //enterModification();
      
      var node = lmdbWrap.addNode(nodeId, data);

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
  ngraph.addLink = function (fromId, toId, data) {
      
      var link = lmdbWrap.addLink(fromId, toId, data);

      return link;

  },

  /**
   * Removes link from the graph. If link does not exist does nothing.
   *
   * @param link - object returned by addLink() or getLinks() methods.
   *
   * @returns true if link was removed; false otherwise.
   */
  ngraph.removeLink = function (link) {
      
      lmdbWrap.removeLink(link);

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
  ngraph.removeNode = function (nodeId) {
      
      lmdbWrap.removeNode(nodeId);

      return true;
  },

  /**
   * Gets node with given identifier. If node does not exist undefined value is returned.
   *
   * @param nodeId requested node identifier;
   *
   * @return {node} in with requested identifier or undefined if no such node exists.
   */
  ngraph.getNode = function (nodeId, callback) {
      return lmdbWrap.getNode(nodeId, callback);
  },

  /**
   * Gets number of nodes in this graph.
   *
   * @return number of nodes in the graph.
   */
  ngraph.getNodesCount = function () {
      return lmdbWrap.getNodesCount();
      //return nodesCount;
  },

  /**
   * Gets total number of links in the graph.
   */
  ngraph.getLinksCount = function () {
      return lmdbWrap.getLinksCount();
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
  ngraph.getLinks = function (nodeId) {
      
      return lmdbWrap.getLinks(nodeId);            
  },

  /**
   * Invokes callback on each node of the graph.
   *
   * @param {Function(node)} callback Function to be invoked. The function
   *   is passed one argument: visited node.
   */
  ngraph.forEachNode = lmdbWrap.forEachNode,

  /**
   * Invokes callback on every linked (adjacent) node to the given one.
   *
   * @param nodeId Identifier of the requested node.
   * @param {Function(node, link)} callback Function to be called on all linked nodes.
   *   The function is passed two parameters: adjacent node and link object itself.
   * @param oriented if true graph treated as oriented.
   */
  ngraph.forEachLinkedNode = lmdbWrap.forEachLinkedNode,

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
  ngraph.forEachLink = lmdbWrap.forEachLink,

  /**
   * Suspend all notifications about graph changes until
   * endUpdate is called.
   */
  ngraph.beginUpdate = function () {
      //enterModification();
  },

  /**
   * Resumes all notifications about graph changes and fires
   * graph 'changed' event in case there are any pending changes.
   */
  ngraph.endUpdate = function () {
      //exitModification(this);
  },

  /**
   * Removes all nodes and links from the graph.
   */
  ngraph.clear = lmdbWrap.clear,

  /**
   * Detects whether there is a link between two nodes.
   * Operation complexity is O(n) where n - number of links of a node.
   *
   * @returns link if there is one. null otherwise.
   */
  ngraph.hasLink = lmdbWrap.hasLink;

  return ngraph;

}
