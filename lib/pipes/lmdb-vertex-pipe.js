var VertexPipe = require('../../node_modules/ngraph.shremlin/lib/pipes/vertexPipe');
var LmdbBasePipe = require('./pipes/lmdb-base-pipe');
var VertexLmdbIterator = require('../iterators/vertex-iterator');

module.exports = function(graph, startFrom) {
  //Augment inheritance
  require('util').inherits(VertexPipe, LmdbBasePipe);

  var vertexPipe = new VertexPipe(graph);

  vertexPipe.setSourcePipe(new VertexLmdbIterator(graph, startFrom));
  vertexPipe._moveNext = function() {
    var self = this;
    if (this._sourcePipe.moveNext()) {
      this._sourcePipe.current(function(err, d, index, cursor, txn){
        self._current = d;
        return true;
      });          
    }
    return false;  
  }

}
