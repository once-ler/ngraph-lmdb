var VerticesToEdgesPipe = require(process.cwd()+'/node_modules/ngraph.shremlin/lib/pipes/verticesToEdgesPipe');
var LmdbBasePipe = require(process.cwd()+'/lib/pipes/lmdb-base-pipe');
var EdgeLmdbIterator = require(process.cwd()+'/lib/iterators/edge-iterator');
var pipeSugar = require(process.cwd()+'/lib/pipeSugar');

module.exports = function(graph, mode, filter) {

  //Augment inheritance
  require('util').inherits(VerticesToEdgesPipe, LmdbBasePipe);

  var verticesToEdgesPipe = new VerticesToEdgesPipe(graph, mode, filter);

  verticesToEdgesPipe._moveNext = function () {
  
    while (true) {

      if (this._currentEdgesIterator.filterArr) {
  
        //Already computed in lmdb-pipe-cursor
        var key = this._currentEdgesIterator.filterArr.shift();
        if (!key){
          return false;
        }
        return this._currentEdgesIterator.goToKey(key);

      } else if (this._sourcePipe.moveNext()) {
        // there is no more edges for this node. Let's move forward to next node.
        
        //this._currentEdgesIterator = createEdgeIterator(this._sourcePipe.current(), this._matchModeFilter);
        
        var self = this;
        this._sourcePipe.current(function(err, d, index, cursor, txn){
          if (typeof self._sourcePipe.filter == 'string'){
            filter = self._sourcePipe.filter + ':' + filter; 
          }
          self._currentEdgesIterator = new EdgeLmdbIterator(graph, mode, filter);
          
        });
        
        // next iteration of the outter loop will either return matching edge
        // or take next vertex or result in false response for _moveNext()
      } else {
        // there is no nodes to start from left
        //console.log(this._currentEdgesIterator);
  
        return false;
      }
    }
    
  };

  return verticesToEdgesPipe;
}









