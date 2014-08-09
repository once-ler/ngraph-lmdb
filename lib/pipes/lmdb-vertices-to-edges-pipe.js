var VerticesToEdgesPipe = require('../../node_modules/ngraph.shremlin/lib/pipes/VerticesToEdgesPipe');
var LmdbBasePipe = require('./pipes/lmdb-base-pipe');
var VertexLmdbIterator = require('../iterators/edge-iterator');

module.exports = function(graph, mode, filter) {
  //Augment inheritance
  require('util').inherits(VerticesToEdgesPipe, LmdbBasePipe);

  var verticesToEdgesPipe = new VerticesToEdgesPipe(graph, mode, filter);

  verticesToEdgesPipe.setSourcePipe(new VertexLmdbIterator(graph, mode, filter));
  
  verticesToEdgesPipe._moveNext = function () {
  
    while (true) {
      if (this._currentEdgesIterator.moveNext()) {
        //this._current = this._currentEdgesIterator.current();
        var self = this;
        this._currentEdgesIterator.current(function(err, d){
          self._current = d;
        });
        return true;
      } else if (this._sourcePipe.moveNext()) {
        // there is no more edges for this node. Let's move forward to next node.
        
        //this._currentEdgesIterator = createEdgeIterator(this._sourcePipe.current(), this._matchModeFilter);
        
        var self = this;
        this._sourcePipe.current(function(err, d, index, cursor, txn){
          self._currentEdgesIterator = createEdgeIterator(d, self._matchModeFilter);
        });
        
        // next iteration of the outter loop will either return matching edge
        // or take next vertex or result in false response for _moveNext()
      } else {
        // there is no nodes to start from left
        return false;
      }
    }
    
  };

}









