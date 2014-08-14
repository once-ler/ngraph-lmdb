var graph = require('../index')();
var shremlin = require('../lib/lmdb-shremlin-wrap');
var g = shremlin(graph);

//Get all vertices
g.V().forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});

//Get one by key value
g.V('0').forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});

/*
g.V({id:'5'}).forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});
*/

