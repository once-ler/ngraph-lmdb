var EdgesToVerticesPipe = require('../../node_modules/ngraph.shremlin/lib/pipes/EdgesToVerticesPipe');
var LmdbBasePipe = require('./pipes/lmdb-base-pipe');
var VertexLmdbIterator = require('../iterators/edge-iterator');

module.exports = function(graph, mode) {

  util.inherits(EdgesToVerticesPipe, LmdbBasePipe);

  var edgesToVerticesPipe = new EdgesToVerticesPipe(graph, mode, filter);

  edgesToVerticesPipe.setSourcePipe(new VertexLmdbIterator(graph, mode));

  edgesToVerticesPipe._moveNext = function () {
    while (true) {
      if (this._fromNode) {
        this._current = this._fromNode;
        this._fromNode = null;
        return true;
      } else if (this._toNode) {
        this._current = this._toNode;
        this._toNode = null;
        return true;
      }
      if (this._sourcePipe.moveNext()) {
        // get the next edge and find out which nodes should be visited:
        //var edge = this._sourcePipe.current();
        var edge;
        this._sourcePipe.current(function(err, d, index, cursor, txn){
          edge = d;
        });
        this._updateFromAndToNodes(edge);
        // next iteration will check _from and _to nodes, and emit them
      } else {
        return false;
      }
    }
  };

};
