var async = require('async');

module.exports = function(graph) {

  var shremlin = require('ngraph.shremlin');

  shremlin.V = function(startFrom) {
      var VertexPipe = require('../node_modules/ngraph.shremlin/lib/pipes/vertexPipe');
      var VertexIterator = require('../node_modules/ngraph.shremlin/lib/iterators/vertexIterator');
      var LmdbBasePipe = require('./lmdb-base-pipe');

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

function VertexLmdbIterator (graph, startFrom) {

  var PipeCursor = require('./lmdb-pipe-cursor');

  var lmdbVertexCursor = new PipeCursor('vertex');

  return lmdbVertexCursor;

};