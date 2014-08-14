var async = require('async');

module.exports = function(graph) {

  var shremlin = require('ngraph.shremlin');

  shremlin.V = function(startFrom) {
    
    return require('./pipes/lmdb-vertex-pipe')(graph, startFrom);    

  }

  return shremlin;
}

//Augment pipes here
var extendIterators = require('./pipeSugar');
extendIterators();
