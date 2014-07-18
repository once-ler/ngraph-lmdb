var async = require('async');

module.exports = function(graph) {

  var shremlin = require('ngraph.shremlin');

  shremlin.V = function(startFrom) {
      var VertexPipe = require('../node_modules/ngraph.shremlin/lib/pipes/vertexPipe');
      var VertexIterator = require('../node_modules/ngraph.shremlin/lib/iterators/vertexIterator');

      //Override VertexPipe, probably need to override BasePipe
      VertexPipe.prototype._moveNext = function () {
        if (this._sourcePipe.moveNext()) {
          this._current = this._sourcePipe.current();                      
        }
        else {
          return false;
        }
      };
      VertexPipe.prototype.current = function (cb) {
        //return this._current;
        //var self = this;
        this._sourcePipe.current(function(err, d){
          //self._current = d;
          cb(null, d);
        });
      };
      VertexPipe.prototype.moveNext = function () {
        
        if (this._sourcePipe.moveNext()) {
          return true;
        }
        else {
          return false;
        }

        /*
        if (this._moveNext()) {
          this._current = this.current();
          return true;
        }
        return false;
        */

      };
      VertexPipe.prototype.forEach = function (callback) {
        
        if (typeof callback !== 'function') {
          throw new Error("Callback is expected to be a function");
        }
        
        var self = this;
        async.whilst(
          function() { return self.moveNext(); }, //sync test, move the cursor
          function (callback) {
              //async fetch
              setTimeout( function() {
                self.current(callback); 
              }, 0 ); 
          },
          function (err) {
              //final callback, no op
              return self;
          }
        );

        /*
        while (this.moveNext()) {
          callback(this.current());
        }
        return this;
        */

      };

      var vertexPipe = new VertexPipe(graph);
      
      if (startFrom) {
        //Change this later
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

  var lmdbWrap = require('./lmdb-wrap')();

  var lmdbVertexCursor = new lmdbWrap.VertexCursor();

  return lmdbVertexCursor;

};