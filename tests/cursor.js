var graph = require('../index')();
var shremlin = require('../lib/lmdb-shremlin-wrap');
var g = shremlin(graph);

g.V().forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});