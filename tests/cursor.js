var graph = require('../index')();
var shremlin = require('../lib/lmdb-shremlin-wrap');
var g = shremlin(graph);


//Get all vertices
/***
expect:
{ id: '0' }
{ id: '1' }
{ id: '2' }
{ id: '3' }
{ id: '4' }
{ id: '5' }
{ id: '6' }
{ id: '7' }
{ id: '8' }
{ id: '9' }
**/
/*
g.V().forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});
*/

//Get one by key value
/***
expect:
{ id: '0' }
**/
/*
g.V('0').forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});
*/

//Get title containing 'even', expect 0,2,4,6,8
/***
expect:
title:even [ '0', '2', '4', '6', '8' ]
{ id: '0' }
{ id: '2' }
{ id: '4' }
{ id: '6' }
{ id: '8' }
**/
/*
g.V({title:'even'}).forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});
*/

//Get title containing 'odd', expect 1,3,5,7,9
/***
expect:
title:odd [ '1', '3', '5', '7', '9' ]
{ id: '1' }
{ id: '3' }
{ id: '5' }
{ id: '7' }
{ id: '9' }
**/
/*
g.V({title:'odd'}).forEach(function(err, d, index, cursor, txn) {
  console.log(d);
  if (index > 99){
    cursor.close();
    txn.abort();
  }
});
*/

/***
expect:
{ fromId: '0', toId: '2', id: '0:knows:2', label: 'knows' }
{ fromId: '0', toId: '2', id: '0:knows:2@1', label: 'knows' }
{ fromId: '0', toId: '7', id: '0:knows:7', label: 'knows' }
{ fromId: '0', toId: '9', id: '0:knows:9', label: 'knows' }
**/
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
*/

/***
expect:
{ fromId: '1', toId: '1', id: '1:studies:1', label: 'studies' }
{ fromId: '1', toId: '7', id: '1:studies:7', label: 'studies' }
{ fromId: '1', toId: '8', id: '1:studies:8', label: 'studies' }
**/
/*
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

/**
expect:
[ { id: '0' },
  { fromId: '0', toId: '2', id: '0:likes:2', label: 'likes' } ]
[ { id: '0' },
  { fromId: '0', toId: '3', id: '0:likes:3', label: 'likes' } ]
[ { id: '0' },
  { fromId: '0', toId: '7', id: '0:likes:7', label: 'likes' } ]
**/
/*
g.V('0')
  .outE('likes')
  .path()
  .forEach(function(err, path) {
    console.log(path);
  });
*/

/***
expect:
[ { id: '2' },
  { fromId: '2', toId: '0', id: '2:studies:0', label: 'studies' },
  { id: '0' } ]
[ { id: '2' },
  { fromId: '2', toId: '1', id: '2:studies:1', label: 'studies' },
  { id: '1' } ]
[ { id: '2' },
  { fromId: '2', toId: '9', id: '2:studies:9', label: 'studies' },
  { id: '9' } ]
**/
/*
g.V('2')
  .outE('studies')
  .inV()
  .path()
  .forEach(function(err, path) {
    console.log(path);
  });
*/

/***
expect:
{ id: '0' }
{ id: '3' }
{ id: '7' }
**/
/*
g.V('3')
  .out('studies')
  .forEach(function(err, d, index, cursor, txn) {
    console.log(d);
    if (index > 99){
      cursor.close();
      txn.abort();
    }
  });
*/

/***
expect:
{ id: '0' }
{ id: '1' }
{ id: '1' }
{ id: '7' }
{ id: '3' }
{ id: '5' }
{ id: '9' }
{ id: '0' }
{ id: '1' }
{ id: '9' }
**/
/*
g.V('2')
  .out()
  .forEach(function(err, d, index, cursor, txn) {
    console.log(d);
    if (index > 99){
      cursor.close();
      txn.abort();
    }
  });
*/

/*
outE('knows')
{ fromId: '1', toId: '3', id: '1:knows:3', label: 'knows' }
{ fromId: '1', toId: '4', id: '1:knows:4', label: 'knows' }
{ fromId: '1', toId: '4', id: '1:knows:4@1', label: 'knows' }
{ fromId: '1', toId: '5', id: '1:knows:5', label: 'knows' }
inV()
3
4
4
5
expect:
outE('studies')
//note: 1:knows:3
{ fromId: '3', toId: '0', id: '3:studies:0', label: 'studies' }
{ fromId: '3', toId: '3', id: '3:studies:3', label: 'studies' }
{ fromId: '3', toId: '7', id: '3:studies:7', label: 'studies' }
//note: 1:knows:4
{ fromId: '4', toId: '1', id: '4:studies:1', label: 'studies' }
{ fromId: '4', toId: '4', id: '4:studies:4', label: 'studies' }
{ fromId: '4', toId: '8', id: '4:studies:8', label: 'studies' }
//note: 1:knows:4@1
{ fromId: '4', toId: '1', id: '4:studies:1', label: 'studies' }  
{ fromId: '4', toId: '4', id: '4:studies:4', label: 'studies' }
{ fromId: '4', toId: '8', id: '4:studies:8', label: 'studies' }
//note: 1:knows:5
{ fromId: '5', toId: '6', id: '5:studies:6', label: 'studies' }
{ fromId: '5', toId: '7', id: '5:studies:7', label: 'studies' }
{ fromId: '5', toId: '8', id: '5:studies:8', label: 'studies' }

g.V('1')
  .outE('knows')
  .inV()
  .outE('studies') //WORKING!!
  .forEach(function(err, d, index, cursor, txn) {
    console.log(d);
    if (index > 99){
      cursor.close();
      txn.abort();
    }
  });
*/

/*
expect:
{ id: '0' }
{ id: '3' }
{ id: '7' }
{ id: '1' }
{ id: '4' }
{ id: '8' }
{ id: '1' }
{ id: '4' }
{ id: '8' }
{ id: '6' }
{ id: '7' }
{ id: '8' }

g.V('1')
  .outE('knows')
  .inV()
  .outE('studies')
  .inV()
  .forEach(function(err, d, index, cursor, txn) {
    console.log(d);
    if (index > 99){
      cursor.close();
      txn.abort();
    }
  });
*/

/**
  complicated path, 5 traversals
  1->knows->studies->likes->

  example output:
  [ { id: '1' },
  { fromId: '1', toId: '5', id: '1:knows:5', label: 'knows' },
  { id: '5' },
  { fromId: '5', toId: '8', id: '5:studies:8', label: 'studies' },
  { id: '8' },
  { fromId: '8', toId: '1', id: '8:likes:1@1', label: 'likes' },
  { id: '1' },
  { fromId: '1', toId: '4', id: '1:knows:4', label: 'knows' },
  { id: '4' },
  { fromId: '4', toId: '8', id: '4:studies:8', label: 'studies' },
  { id: '8' } ]
**/
g.V('1')
  .outE('knows')
  .inV()
  .outE('studies')
  .inV()
  .outE('likes')
  .inV()
  .outE('knows')
  .inV()
  .outE('studies')
  .inV()
  .path()
  .forEach(function(err, path) {
    console.log(path);
  });



/*
  Get all out edges for '1', expect:

{ fromId: '1', toId: '3', id: '1:knows:3', label: 'knows' }
{ fromId: '1', toId: '4', id: '1:knows:4', label: 'knows' }
{ fromId: '1', toId: '4', id: '1:knows:4@1', label: 'knows' }
{ fromId: '1', toId: '5', id: '1:knows:5', label: 'knows' }
{ fromId: '1', toId: '5', id: '1:likes:5', label: 'likes' }
{ fromId: '1', toId: '9', id: '1:likes:9', label: 'likes' }
{ fromId: '1', toId: '9', id: '1:likes:9@1', label: 'likes' }
{ fromId: '1', toId: '1', id: '1:studies:1', label: 'studies' }
{ fromId: '1', toId: '7', id: '1:studies:7', label: 'studies' }
{ fromId: '1', toId: '8', id: '1:studies:8', label: 'studies' }

g.V('1')
  .outE()
  .forEach(function(err, d, index, cursor, txn) {
    console.log(d);
    if (index > 99){
      cursor.close();
      txn.abort();
    }
  });
*/