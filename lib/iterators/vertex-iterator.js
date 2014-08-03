function VertexLmdbIterator (graph, startFrom) {

  var PipeCursor = require('../pipes/lmdb-pipe-cursor');

  var lmdbVertexCursor = new PipeCursor('vertex');

  return lmdbVertexCursor;

};

module.exports = VertexLmdbIterator;