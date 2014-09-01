/**
 * # Path Pipe
 *
 * PathPipe allows clients to understand how traversal algorithm
 * reached given node. It takes as a source any type of `BasePipe`
 * child, and emits array of objects (vertices, edges, etc.) through
 * which it went to reach final point
 *
 * Example of traversal for [Graph of Gods](https://raw.github.com/wiki/thinkaurelius/titan/images/graph-of-the-gods-2.png):
 *
 * ```
 *   g.V('hercules')  // get 'hercules' vertex
 *    .out('father')  // Who is father of Hercules?
 *    .out('brother') // Get all Hercules uncles
 *    .out('pet')     // Get pets of Hercules uncles.
 *    .path()         // Get traversal path
 *    .forEach(function (path) {
 *      // path is array of vertices
 *      // [hercules] -> [father] -> [brother] -> [pet]
 *      console.log(path);
 *    });
 * ```
 */

var PathPipe = require(process.cwd()+'/node_modules/ngraph.shremlin/lib/pipes/pathPipe');
var LmdbBasePipe = require(process.cwd()+'/lib/pipes/lmdb-base-pipe');

module.exports = function(graph) {

  // See also: [BasePipe](../basePipe.html)
  require('util').inherits(PathPipe, LmdbBasePipe);

  var pathPipe = new PathPipe(graph);
  //pathPipe.setSourcePipe(new require(process.cwd()+'/node_modules/ngraph.shremlin/lib/iterators/emptyIterator'));

  /**
    Must override moveNext().
    For the verticesToEdgesPipe, the _current value is the key to the edge object.
    We must use this reference and fetch on demand via _moveNext::this._sourcePipe.getCurrentPath()
  **/
  pathPipe.moveNext = function () {
    if (this._moveNext()) {
      
      //var self = this;
      //this.current(function(err, d) {
      //  self._current = d;
      //});      

      return true;
    }
    else {
      return false;
    }

  };
  
  pathPipe._moveNext = function () {
    
    if (this._sourcePipe.moveNext()) {
      this._current = this._sourcePipe.getCurrentPath();
      return true;
    }
    return false;
    
  };

  return pathPipe;

};