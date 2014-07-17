var graph = require('../index')();
var shremlin = require('../lib/lmdb-shremlin-wrap');
var g = shremlin(graph);

g.V().forEach(function(d) {
  console.log(d);
});