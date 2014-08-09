module.exports = createEdgeIterator;

var createEdgeIterator = function VertexLmdbIterator (vertex, mode, matchFilter) {

  if (vertex === undefined) {
    throw new Error('Vertex should be defined in edge iterator');
  }

  /*
  matchFilter = typeof matchFilter === 'function' ?
                  matchFilter : function () { return true; };
  */
  
  var PipeCursor = require('./pipes/lmdb-pipe-cursor');

  var lmdbEdgeCursor = new PipeCursor(mode, matchFilter);

  return lmdbEdgeCursor;

};
