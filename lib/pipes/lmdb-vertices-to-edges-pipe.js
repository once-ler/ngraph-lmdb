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

      if (this._sourcePipe._currentVerticesIterator)
        console.log('_currentVerticesIterator->'+this._sourcePipe._currentVerticesIterator._current)
      console.log(filter);
      if (this._currentEdgesIterator)
        console.log('_currentEdgesIterator->' + (this._currentEdgesIterator.filterArr ? this._currentEdgesIterator.filterArr.length : 0))
      
      if (this._currentEdgesIterator.filterArr && this._currentEdgesIterator.filterArr.length > 0) {
      //if (this._currentEdgesIterator.filterArr) {
        //Already computed in lmdb-pipe-cursor
        var key = this._currentEdgesIterator.filterArr.shift();
        if (!key){
          return false;
        }
        //Need to set _current
        this._currentEdgesIterator.goToKey(key);
        /*
        var self = this;
        this._currentEdgesIterator.current(function(err,d){
          self._current = d;
        });
        */

        return true;
        
      } 
      else if (this._sourcePipe._currentVerticesIterator && this._sourcePipe._currentVerticesIterator._current){
        /**
          Note:
          this._sourcePipe.current would be if we started with g.V()
          but
          this._sourcePipe._currentVerticesIterator.current would be anything after ie g.V().out().inE()
        **/
        var self = this;
        console.log(this._sourcePipe._currentVerticesIterator._current)
        this._sourcePipe._currentVerticesIterator.current(function(err, d, index, cursor, txn){
          if (typeof filter == 'string'){
            var _filter = self._sourcePipe._currentVerticesIterator._current + ':' + filter;
          }          
          self._currentEdgesIterator = new EdgeLmdbIterator(graph, mode, _filter);
        });
        
      }
      else if (this._sourcePipe.moveNext()) {

        // there is no more edges for this node. Let's move forward to next node.
        var self = this;
        this._sourcePipe.current(function(err, d, index, cursor, txn){
          if (typeof self._sourcePipe.filter == 'string'){
            filter = self._sourcePipe.filter + ':' + filter; 
            console.log(filter)           
          }
          self._currentEdgesIterator = new EdgeLmdbIterator(graph, mode, filter);
        });

        // next iteration of the outter loop will either return matching edge
        // or take next vertex or result in false response for _moveNext()      
      }
      else {
        // there is no nodes to start from left
        //console.log(this._currentEdgesIterator);
  
        return false;
      }
    }
    
  };

  return verticesToEdgesPipe;
}









