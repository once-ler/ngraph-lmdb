var VertexPipe = require(process.cwd()+'/node_modules/ngraph.shremlin/lib/pipes/vertexPipe');
var LmdbBasePipe = require(process.cwd()+'/lib/pipes/lmdb-base-pipe');
var VertexLmdbIterator = require(process.cwd()+'/lib/iterators/vertex-iterator');

module.exports = function(graph, startFrom) {
  //Augment inheritance
  require('util').inherits(VertexPipe, LmdbBasePipe);

  var vertexPipe = new VertexPipe(graph);

  vertexPipe.setSourcePipe(new VertexLmdbIterator(graph, startFrom));
  vertexPipe.filter = startFrom;
  
  vertexPipe._moveNext = function() {
    
    if (typeof startFrom == 'string' ){
      if (this._sourcePipe._current){    
        this._sourcePipe._current = false;
        return true;
      }
      else {
        return false;
      }
    }

    return this._sourcePipe.moveNext();
      
  }

  return vertexPipe;
}
