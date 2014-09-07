var VerticesToVerticesPipe = require(process.cwd() + '/node_modules/ngraph.shremlin/lib/pipes/verticesToVerticesPipe');
var LmdbBasePipe = require(process.cwd() + '/lib/pipes/lmdb-base-pipe');
var EdgeLmdbIterator = require(process.cwd()+'/lib/iterators/edge-iterator');
var VertexLmdbIterator = require(process.cwd() + '/lib/iterators/vertex-iterator');
var pipeSugar = require(process.cwd()+'/lib/pipeSugar');

module.exports = function(graph, mode, filter) {
  
  //Augment inheritance
  require('util').inherits(VerticesToVerticesPipe, LmdbBasePipe);

   //Augment pipe sugar
  pipeSugar.augmentVerticesPipes(VerticesToVerticesPipe.prototype);
  pipeSugar.augmentGenericPipe(VerticesToVerticesPipe.prototype);

  var verticesToVerticesPipe = new VerticesToVerticesPipe(graph, mode, filter);

  //Initialize both edge iterator, if no filter, this will be used
  verticesToVerticesPipe._currentVerticesIterator = new VertexLmdbIterator(graph);
  
  function getInNode(link) {
    var node = this._currentVerticesIterator.goToKey(link.fromId);
    if (node){
      var self = this;
      this._currentVerticesIterator.current(function(err,d){
        self._current = d;
      });
    }
    else {
      throw new Error("Edge link starts at removed node");
    }
  }
  function getOutNode(link) {
    var node = this._currentVerticesIterator.goToKey(link.toId);
    if (node){
      var self = this;
      this._currentVerticesIterator.current(function(err,d){
        self._current = d;
      });
    }
    else {
      throw new Error("Edge link points to removed node");
    }
  }
  function getOtherNode(link, nodeId) {
    var otherNodeId = link.fromId === nodeId ? link.toId : link.fromId;
    
    var node = this._currentVerticesIterator.goToKey(otherNodeId);
    if (node){
      var self = this;
      this._currentVerticesIterator.current(function(err,d){
        self._current = d;
      });
    }
    else {
      throw new Error("Edge link starts or ends at removed node");
    }
  }

  if (mode === 'out') {
    //verticesToVerticesPipe._linkFilter = outNodeFilter;
    verticesToVerticesPipe._getNode = getOutNode;
  } else if (mode === 'in') {
    //verticesToVerticesPipe._linkFilter = inNodeFilter;
    verticesToVerticesPipe._getNode = getInNode;
  } else if (mode === 'both') {
    //verticesToVerticesPipe._linkFilter = bothNodeFilter;
    verticesToVerticesPipe._getNode = getOtherNode;
  } else {
    throw new Error("Unsupported mode of VerticesToVerticesPipe. Expected (out|in|both), got: " + mode);
  }

  verticesToVerticesPipe._moveNext = function () {
    
    //TODO: if the there's no filter like out() (filter means out('knows')), doesn't return anything
    //Need to fix
    while (true) {
      //if (this._currentEdgesIterator.moveNext()) {
      if ((filter && this._currentEdgesIterator.filterArr) || (!filter && this._currentEdgesIterator.moveNext())) {
  
        if (filter) {
          //Already computed in lmdb-pipe-cursor
          var key = this._currentEdgesIterator.filterArr.shift();
          if (!key){
            return false;
          }
          
          //Need to set _current
          this._currentEdgesIterator.goToKey(key);  
        }

        // We have neighbor node which matches search criteria. Get it:
        //var edge = this._currentEdgesIterator.current();
        //var currentVertex = this._sourcePipe.current();
        var edge;
        this._currentEdgesIterator.current(function(err, d, index, cursor, txn){
          edge = d;
        });
        
        var currentVertex;
        this._sourcePipe.current(function(err, d, index, cursor, txn){
          currentVertex = d;
        });      
        
        //this._current = this._getNode(edge, currentVertex.id);
        this._getNode(edge, currentVertex.id);
        return true;

      } else if (this._sourcePipe.moveNext()) {

        // There is no more edges for the current node. Let's move forward to next node.
        //this._currentEdgesIterator = createEdgeIterator(this._sourcePipe.current(), this._linkFilter);
        var self = this;
        this._sourcePipe.current(function(err, d, index, cursor, txn){
          if (typeof self._sourcePipe.filter == 'string'){
            //if nodeId == "2", if there's no filter, need to get all edges for "2"
            filter = self._sourcePipe.filter + ':' + (typeof filter == 'undefined' ? '.*' : filter) ; 
          }
          self._currentEdgesIterator = new EdgeLmdbIterator(graph, mode, filter);          
        });

        // Next iteration of the outter loop will either return matching edge
        // or take next vertex or result in false response for _moveNext()
      } else {
        // There is no nodes to start from left
        return false;
      }
    }

  };

  return verticesToVerticesPipe;

};

