var EdgesToVerticesPipe = require(process.cwd()+'/node_modules/ngraph.shremlin/lib/pipes/edgesToVerticesPipe');
var LmdbBasePipe = require(process.cwd() + '/lib/pipes/lmdb-base-pipe');
var VertexLmdbIterator = require(process.cwd() + '/lib/iterators/vertex-iterator');
var pipeSugar = require(process.cwd()+'/lib/pipeSugar');

module.exports = function(graph, mode, filter) {

  //Augment inheritance
  require('util').inherits(EdgesToVerticesPipe, LmdbBasePipe);

  //Augment pipe sugar
  pipeSugar.augmentVerticesPipes(EdgesToVerticesPipe.prototype);
  pipeSugar.augmentGenericPipe(EdgesToVerticesPipe.prototype);

  //EdgesToVerticesPipe.prototype._currentVerticesIterator = {};

  var edgesToVerticesPipe = new EdgesToVerticesPipe(graph, mode, filter);

  edgesToVerticesPipe._currentVerticesIterator = new VertexLmdbIterator(graph);
  
  //Override _updateFromAndToNodes
  if (mode == 'out') {
    edgesToVerticesPipe._updateFromAndToNodes = function (edge) {      
      //this._fromNode = edge.fromId;
      //this._toNode = null;
      
      this._currentVerticesIterator.goToKey(edge.fromId);
      var self = this;
      this._currentVerticesIterator.current(function(err,d){
        self._fromNode = d;
      });
      self._toNode = null;
      
    };
  }
  if (mode == 'in') {
    edgesToVerticesPipe._updateFromAndToNodes = function (edge) {      
      
      
      this._currentVerticesIterator.goToKey(edge.toId);
      var self = this;
      this._currentVerticesIterator.current(function(err,d){
        self._toNode = d;
      });
      self._fromNode = null;
      
    };
  }
  if (mode == 'both') {
    edgesToVerticesPipe._updateFromAndToNodes = function (edge) {
      
      this._currentVerticesIterator.goToKey(edge.fromId);
      var self = this;
      this._currentVerticesIterator.current(function(err,d){
        self._fromNode = d;
      });
      this._currentVerticesIterator.goToKey(edge.toId);
      this._currentVerticesIterator.current(function(err,d){
        self._toNode = d;
      });

    };
  }

  edgesToVerticesPipe._moveNext = function () {

  //console.log('Starting graph.getNode(\'0\')');

  //edgesToVerticesPipe._currentVerticesIterator.goToKey('0');
  //edgesToVerticesPipe._currentVerticesIterator.current(function(err,d){
  //  console.log(d);
  //})

    //console.log(this._updateFromAndToNodes.toString())
      
    while (true) {
      if (this._fromNode && !this._toNode) {
        this._current = this._fromNode;
        this._fromNode = null;
        return true;
      } else if (this._toNode && !this._fromNode) {
        this._current = this._toNode;
        this._toNode = null;
        return true;
      } else if (this._toNode && this._fromNode) {
        this._current = [this._fromNode, this._toNode];
        this._fromNode = null;
        this._toNode = null;
        return true;
      }

      if (this._sourcePipe.moveNext()) {
        
        //console.log(this._sourcePipe._currentEdgesIterator._current);

        // get the next edge and find out which nodes should be visited:
        //var edge = this._sourcePipe.current();
        
        /**
          The incoming sourcePipe should must have _currentEdgesIterator
          because it is of type verticesToEdgesPipe
        **/
        var edge;
        this._sourcePipe._currentEdgesIterator.current(function(err, d, index, cursor, txn){
          edge = d;
        });
        this._updateFromAndToNodes(edge);
        // next iteration will check _from and _to nodes, and emit them

      } else {
        return false;
      }
    }
  };

  return edgesToVerticesPipe;

};
