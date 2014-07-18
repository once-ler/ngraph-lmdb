var graph = require('../index')();
var shremlin = require('../lib/lmdb-shremlin-wrap');
var g = shremlin(graph);

var counter=-1;
g.V().forEach(function(err, d) {
  console.log(counter++);
});