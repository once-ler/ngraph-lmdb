var VertexPipe = require(process.cwd()+'/node_modules/ngraph.shremlin/lib/pipes/vertexPipe');
var LmdbBasePipe = require(process.cwd()+'/lib/pipes/lmdb-base-pipe');
var VertexLmdbIterator = require(process.cwd()+'/lib/iterators/vertex-iterator');
var pipeSugar = require(process.cwd()+'/lib/pipeSugar');

module.exports = function(graph, startFrom) {
  //Augment inheritance
  require('util').inherits(VertexPipe, LmdbBasePipe);

  //Augment pipe sugar
  pipeSugar.augmentVerticesPipes(VertexPipe.prototype);

  var vertexPipe = new VertexPipe(graph);

  vertexPipe.setSourcePipe(new VertexLmdbIterator(graph, startFrom));
  vertexPipe.filter = startFrom;
  
  vertexPipe._moveNext = function() {
    
    if (typeof startFrom == 'string' || typeof startFrom == 'object' ){
      //Already computed in lmdb-pipe-cursor
      if (this._sourcePipe.filterArr){
        var key = this._sourcePipe.filterArr.shift();
        if (!key){
          return false;
        }
        return this._sourcePipe.goToKey(key);
      }
      
      return false; 
    }

    return this._sourcePipe.moveNext();
      
  }

  return vertexPipe;
}
