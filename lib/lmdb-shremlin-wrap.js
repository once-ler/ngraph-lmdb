var async = require('async');

module.exports = function(graph) {

  var shremlin = require('ngraph.shremlin');

  shremlin.V = function(startFrom) {
      var VertexPipe = require('../node_modules/ngraph.shremlin/lib/pipes/vertexPipe');
      //var VertexIterator = require('../node_modules/ngraph.shremlin/lib/iterators/vertexIterator');
      var VertexIterator = function(){};
      var LmdbBasePipe = require(__dirname+'/pipes/lmdb-base-pipe');
      var VertexLmdbIterator = require(__dirname+'/iterators/vertex-iterator');

      //Override inheritance
      require('util').inherits(VertexPipe, LmdbBasePipe);
      
      var vertexPipe = new VertexPipe(graph);
      
      if (startFrom) {
        //Change this later
        vertexPipe.setSourcePipe(new VertexIterator(graph, startFrom));
      }
      else {
        //return lmdb cursor
        vertexPipe.setSourcePipe(new VertexLmdbIterator(graph, startFrom));

      }
      return vertexPipe;
    }

  return shremlin;
}
