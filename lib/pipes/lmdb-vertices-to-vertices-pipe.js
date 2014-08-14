var VerticesToVerticesPipe = require(process.cwd() + '/node_modules/ngraph.shremlin/lib/pipes/verticesToVerticesPipe');
var LmdbBasePipe = require(process.cwd() + '/lib/pipes/lmdb-base-pipe');
var VertexLmdbIterator = require(process.cwd() + '/lib/iterators/vertex-iterator')

module.exports = function(graph, mode, filter) {
  //Augment inheritance
  require('util').inherits(VerticesToVerticesPipe, LmdbBasePipe);

  var verticesToVerticesPipe = new VerticesToVerticesPipe(graph, mode, filter);

  verticesToVerticesPipe.setSourcePipe(new VertexLmdbIterator(graph, filter));
  verticesToVerticesPipe._moveNext = function () {
    while (true) {
      if (this._currentEdgesIterator.moveNext()) {
        // We have neighbor node which matches search criteria. Get it:
        //var edge = this._currentEdgesIterator.current();
        //var currentVertex = this._sourcePipe.current();
        var edge;
        var currentVertex;
        this._currentEdgesIterator.current(function(err, d, index, cursor, txn){
          edge = d;
        });
        this._sourcePipe.current(function(err, d, index, cursor, txn){
          currentVertex = d;
        });      
        this._current = this._getNode(edge, currentVertex.id);
        return true;
      } else if (this._sourcePipe.moveNext()) {
        // There is no more edges for the current node. Let's move forward to next node.
        //this._currentEdgesIterator = createEdgeIterator(this._sourcePipe.current(), this._linkFilter);
        var self;
        this._sourcePipe.current(function(err, d, index, cursor, txn){
          self._currentEdgesIterator = createEdgeIterator(d, self._linkFilter);
        }); 
        // Next iteration of the outter loop will either return matching edge
        // or take next vertex or result in false response for _moveNext()
      } else {
        // There is no nodes to start from left
        return false;
      }
    }
  };

};

