function VertexLmdbIterator (graph, startFrom) {

  var PipeCursor = require('../pipes/lmdb-pipe-cursor');

  var lmdbVertexCursor = new PipeCursor('vertex', startFrom);

  return lmdbVertexCursor;

};

module.exports = VertexLmdbIterator;