module.exports = createEdgeIterator;

var createEdgeIterator = function VertexLmdbIterator (vertex, matchFilter) {

  if (vertex === undefined) {
    throw new Error('Vertex should be defined in edge iterator');
  }

  matchFilter = typeof matchFilter === 'function' ?
                  matchFilter : function () { return true; };

  var PipeCursor = require('./pipes/lmdb-pipe-cursor');

  var lmdbBothEdgeCursor = new PipeCursor('both');

  return lmdbBothEdgeCursor;

};
