var graph = require('../index')();
var shremlin = require('../lib/lmdb-shremlin-wrap');
var g = shremlin(graph);

/*
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

//Get title containing 'even', expect 0,2,4,6,8
g.V({title:'even'}).forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});

//Get title containing 'odd', expect 1,3,5,7,9
g.V({title:'odd'}).forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});
*/

/*
g.V('0')
  .outE('knows')
  .forEach(function(err, d, index, cursor, txn) {
    console.log(d);
    if (index > 99){
      cursor.close();
      txn.abort();
    }
  });

g.V('1')
  .inE('studies')
  .forEach(function(err, d, index, cursor, txn) {
    console.log(d);
    if (index > 99){
      cursor.close();
      txn.abort();
    }
  });
*/

//var n = graph.getNode('0');
//console.log(n);

/*
g.V('0')
  .outE('likes')
  .path()
  .forEach(function(err, path) {
    console.log(path);
  });
*/

g.V('0')
  .outE('likes')
  .inV()
  .path()
  .forEach(function(err, path) {
    console.log(path);
  });

/*
var w = g.V('0')
  .outE('likes')
  .path();

  console.log(w)
*/

/*
g.V('0')
  .out()
  .forEach(function(err, d, index, cursor, txn) {
    console.log(d);
    if (index > 99){
      cursor.close();
      txn.abort();
    }
  });
*/
