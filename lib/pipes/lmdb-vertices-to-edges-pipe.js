var VerticesToEdgesPipe = require(process.cwd()+'/node_modules/ngraph.shremlin/lib/pipes/verticesToEdgesPipe');
var LmdbBasePipe = require(process.cwd()+'/lib/pipes/lmdb-base-pipe');
var EdgeLmdbIterator = require(process.cwd()+'/lib/iterators/edge-iterator');
var pipeSugar = require(process.cwd()+'/lib/pipeSugar');

module.exports = function(graph, mode, filter) {

  //Augment inheritance
  require('util').inherits(VerticesToEdgesPipe, LmdbBasePipe);

  //Augment pipe sugar
  pipeSugar.augmentEdgesPipes(VerticesToEdgesPipe.prototype);
  pipeSugar.augmentGenericPipe(VerticesToEdgesPipe.prototype);

  var verticesToEdgesPipe = new VerticesToEdgesPipe(graph, mode, filter);

  verticesToEdgesPipe._moveNext = function () {
    
    while (true) {
      
      //if (this._currentEdgesIterator.filterArr && this._currentEdgesIterator.filterArr.length > 0) {
      if ((filter && this._currentEdgesIterator.filterArr && this._currentEdgesIterator.filterArr.length > 0) || (!filter && this._currentEdgesIterator.moveNext())) {
        
        if (filter){
          //Already computed in lmdb-pipe-cursor
          var key = this._currentEdgesIterator.filterArr.shift();
          if (!key){
            return false;
          }
          //Need to set _current
          this._currentEdgesIterator.goToKey(key);
        }
        
        return true;
        
      }
      else if (this._sourcePipe.moveNext()) {

        var self = this;
        var _filter;
        /** Note:
          * this._sourcePipe.current would be if we started with g.V()
          * but
          * this._sourcePipe._currentVerticesIterator.current would be anything after ie g.V().out().inE()
          */
        if (this._sourcePipe._currentVerticesIterator) {
          
          //var self = this, _filter;
          this._sourcePipe._currentVerticesIterator.current(function(err, d, index, cursor, txn){
            if (typeof filter == 'string'){
              _filter = self._sourcePipe._currentVerticesIterator._current + ':' + filter;
              //console.log(_filter)
            }          
            self._currentEdgesIterator = new EdgeLmdbIterator(graph, mode, _filter);
          });
        }
        else {
          
          // there is no more edges for this node. Let's move forward to next node.
          this._sourcePipe.current(function(err, d, index, cursor, txn){
            if (typeof self._sourcePipe.filter == 'string'){
              _filter = self._sourcePipe.filter + ':' + (typeof filter == 'undefined' ? '.*' : filter)                          
            }
            self._currentEdgesIterator = new EdgeLmdbIterator(graph, mode, _filter);
          });
        }
        // next iteration of the outter loop will either return matching edge
        // or take next vertex or result in false response for _moveNext()      
      } 
      else {
        // there is no nodes to start from left
        
        return false;
      }
    }
    
  };

  return verticesToEdgesPipe;
}









