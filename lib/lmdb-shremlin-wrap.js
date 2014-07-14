module.exports = function() {

  var shremlin = require('ngraph.shremlin');

  shremlin.V = function(startFrom) {
      var VertexPipe = require('./node_modules/ngraph.shremlin/lib/pipes/vertexPipe');
      var VertexIterator = require('./node_modules/ngraph.shremlin/lib/iterators/vertexIterator');

      var vertexPipe = new VertexPipe(graph);
      
      if (startFrom) {
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

  var lmdbWrap = require('./lib/lmdb-wrap');

  var cursor = new lmdbWrap.VertexCursor();

  var lmdbCursor = {

    /*
    cursor.goToNext();
    */
    next: cursor.next();

    /*
    cursor.getCurrentBinary(printFunc);
    */
    current: cursor.current();

    close: cursor.close();
  };

  return lmdbCursor;

};