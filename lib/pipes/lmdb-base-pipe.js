/**
 * # Base Pipe
 *
 * Graph traversal operations in Shremlin are achieved by pipes. Pipes accept
 * input data, and emit transformed data. E.g. ```VerticesToVerticesPipe```
 * accepts a vertex as an input and emits adjacent vertices (neighbors). Since
 * each emitted object is also a vertex, it can be used as an input
 * to next `VerticesToVerticesPipe`, forming a _Pipeline_.
 *
 * `BasePipe` serves as an abstract base class for all pipes in Shremlin
 *
 * _NB:_ If you are familiar with concept of [Enumerators](http://msdn.microsoft.com/en-us/library/78dfe2yb.aspx)
 * in .NET this should be familiar. Like `Enumerators` Pipes have `current()`
 * and `moveNext()` methods. On top of this Pipes are chained into each other
 * thus one pipe serves as a data source to another
 */
var async = require('async');

module.exports = LmdbBasePipe;

function LmdbBasePipe() {
  this._current = undefined;
  this._sourcePipe = undefined;
}

// Pipe iteration
// --------------

/**
 * `current()` returns current element of collection. If collection is
 * empty, then undefined value is returned.
 */
 /*
LmdbBasePipe.prototype.current = function () {
  return this._current;
};
*/

LmdbBasePipe.prototype.current = function (cb) {
  this._sourcePipe.current(function(err, d){
    cb(null, d);
  });
};

/**
 * `moveNext()` tries to move `current` element to next position. If
 * moved successfuly this method returns true. Otherwise false
 */
/*
LmdbBasePipe.prototype.moveNext = function () {
  if (this._moveNext()) {
    this._current = this.current();
    return true;
  }

  return false;
};
*/
LmdbBasePipe.prototype.moveNext = function () {
  //if (this._sourcePipe.moveNext()) {
  if (this._moveNext()) {
    var self = this;
    this.current(function(err, d) {
      self._current = d;
    });
    return true;
  }
  else {
    return false;
  }

};

/**
 * Each child of `LmdbBasePipe` should provide concrete implementation
 * of `_moveNext`.
 */
LmdbBasePipe.prototype._moveNext = function (startsIterators) {
  //throw new Error('This method should be implemented by children');
};

/**
 * This is how we tell current pipe where to read data from.
 *
 * @param {LmdbBasePipe} sourcePipe should be an object which implement `moveNext()` and
 *   `current()` methods
 */
LmdbBasePipe.prototype.setSourcePipe = function (sourcePipe) {
  var sourcePipeIsValid = sourcePipe &&
    typeof sourcePipe.moveNext === 'function' &&
    typeof sourcePipe.current === 'function';
  if (!sourcePipeIsValid) {
    throw new Error('setSourcePipe received bad pipe');
  }

  this._sourcePipe = sourcePipe;
};

/**
 * When we want other pipe object to read data from `this` pipe we call
 * `this.pipe(other)`
 *
 * @param {LmdbBasePipe} destinationPipe should be an object which implements
 * `setSourcePipe` method
 */
LmdbBasePipe.prototype.pipe = function (destinationPipe) {
  var destinationPipeIsValid = destinationPipe &&
          typeof destinationPipe.setSourcePipe === 'function';
  if (!destinationPipeIsValid) {
    throw new Error('pipe recieved bad destination pipe');
  }
  console.log('lmdb-base-pipe:pipe->'+JSON.stringify(destinationPipe))
  //console.log('lmdb-base-pipe:pipe->destinationPipe.setSourcePipe->'+JSON.stringify(this))
  destinationPipe.setSourcePipe(this);
  // To get chainable syntax return destinationPipe
  return destinationPipe;
};

/**
 * Pipes will not immediately start iterating over source data, unless
 * we ask them to do so. This allows efficiently delay computation up to the
 * point where it is absolutely necessary. Calling `pipe.forEach` begins data
 * flow.
 *
 * `callback` should be a function which will be called for each element of
 * this pipe.
 *
 * Example:
 * ```
 *   g.V() // creates pipe of graph's vertices
 *     // No iteration will start until we call:
 *    .forEach(function(vertex) {
 *      console.log(v.id); // print all vertices
 *    });
 * ```
 */
/*
LmdbBasePipe.prototype.forEach = function (callback) {
  if (typeof callback !== 'function') {
    throw new Error("Callback is expected to be a function");
  }
  while (this.moveNext()) {
    callback(this.current());
  }

  return this;
};
*/
LmdbBasePipe.prototype.forEach = function (callback) {
  
  if (typeof callback !== 'function') {
    throw new Error("Callback is expected to be a function");
  }
  
  while (this.moveNext()) {
    callback(null, this._current);
  }
  /*
  var self = this;
  async.whilst(
    function() { return self.moveNext(); }, //sync test, move the cursor
    function (next) {
        //async fetch
        setTimeout( function() {
          self.current(function(err, d){
            //call the calling callback
            callback(null, d);
            next();
          }); 
        }, 0 ); 
    },
    function (err) {
        //final callback, no op
        return self;
    }
  );
  */
};
/*
 * Getting path
 * ------------
 *
 * When traversing a graph it is very important to know where we came from
 * to current node. Each `pipe` object has ability to inspect all chain of
 * pipes through which traversal algorithm went.
 *
 * To do so clients should use a [PathPipe](pipes/pathPipe.html).
 */

/**
 * Build array of `current` objects in the chain of source pipes up to this point.
 * And add `current` object of this pipe to the end of the array
 */
/*
LmdbBasePipe.prototype.getCurrentPath = function (callback) {
  var pathToHere = getPathToHere(this._sourcePipe);
  
  pathToHere.push(this._current);
  
  return pathToHere;
};
*/
LmdbBasePipe.prototype.getCurrentPath = function (callback) {
  var pathToHere = getPathToHere(this._sourcePipe);
  
  //Memory issue??
  this.current(function(err, d, index, cursor, txn) {

    pathToHere.push(d);

    callback(null, d);

  });

};
/*
function getPathToHere(LmdbBasePipe) {
  var hasPath = LmdbBasePipe && typeof LmdbBasePipe.getCurrentPath === 'function';
  if (!hasPath) {
    return []; // we are at the start of pipeline
  }

  return LmdbBasePipe.getCurrentPath();
}
*/
function getPathToHere(LmdbBasePipe) {
  var hasPath = LmdbBasePipe && typeof LmdbBasePipe.getCurrentPath === 'function';
  if (!hasPath) {
    return []; // we are at the start of pipeline
  }

  return LmdbBasePipe.getCurrentPath(function(err, d){
    return d;
  });
}