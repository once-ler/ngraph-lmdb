function EdgeLmdbIterator (graph, mode, startFrom) {

  var PipeCursor = require('../pipes/lmdb-pipe-cursor');

  var lmdbEdgeCursor = new PipeCursor(mode, startFrom);

  return lmdbEdgeCursor;

};

module.exports = EdgeLmdbIterator;
