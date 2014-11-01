ngraph persistence with lmdb
============================

A very alpha experimental attempt to using lmdb as the persistence store to ngraph.

Both are best of breed, why not combine the two?

_At this stage of development, the following tests are already passing:_

###Usage
For now, if you want to perform CRUD operations, do the following:
```javascript
NGRAPH_LMDB_HOME=/home/username/node_modules/ngraph-lmdb
cd $NGRAPH_LMDB
node
> var graph = require('./index')();
> graph.addNode('jschmoe', {fullName: 'Joe Schmoe'});
> graph.addNode('jdoe', {fullName: 'John Doe'});
> graph.addLink('jschmoe','jdoe', 'knows',{ tag: 'New York City' });
> graph.forEachNode(console.log);
> graph.forEachLink(console.log);
```

To use the shremlin-like query API, do the following:
```javascript
NGRAPH_LMDB_HOME=/home/username/node_modules/ngraph-lmdb
cd $NGRAPH_LMDB
node
> var shremlin = require('./lib/lmdb-shremlin-wrap');
> var g = shremlin();
> g.V().forEach(function(err, d){ console.log(d); });
> g.V('jschmoe').outE('knows').forEach(function(err, d){ console.log(d); });
> g.V('jschmoe').outE('knows').path().forEach(function(err, d){ console.log(d); });
```

###Configuration
```/lib/lmdb-config.js``` configures your lmdb instance.
The CRUD module and shremlin-like API uses the same configuration file.

```javascript
//lmdb defaults
var lmdbConfig = {

  appendOnly: false,

  env: {
    path: process.cwd() + "/mydata",
    mapSize: 8 * 1024 * 1024 * 1024, // maximum database size
    maxDbs: 10,
    noMetaSync: true,
    noSync: true
  },

  vertexDb: {
    name: "test:vertices",
    create: true // will create if database did not exist
  },

  edgeDb: {
    name: "test:edges",
    create: true
  },

  multiEdgesDb: {
    name: "test:multi-edges",
    create: true
  },

  bothEdgeDb: {
    name: "test:both-edges",
    create: true,
    dupSort: true
  },

  inEdgeDb: {
    name: "test:in-edges",
    create: true,
    dupSort: true
  },

  outEdgeDb: {
    name: "test:out-edges",
    create: true,
    dupSort: true
  },

  statsDb: {
    name: "test:stats",
    create: true
  },

  indexVertexDb: {
    name: "test:indexes-vertices",
    create: true,
    dupSort: true
  },

  indexEdgeDb: {
    name: "test:indexes-edges",
    create: true,
    dupSort: true
  }

}

module.exports = lmdbConfig;
```

# TOC
   - [Setup graph](#setup-graph)
     - [Add 10 nodes & 10 links per node](#setup-graph-add-10-nodes--10-links-per-node)
       - [Count nodes](#setup-graph-add-10-nodes--10-links-per-node-count-nodes)
       - [Count links](#setup-graph-add-10-nodes--10-links-per-node-count-links)
   - [Setup shremlin](#setup-shremlin)
     - [Get all vertices](#setup-shremlin-get-all-vertices)
     - [Get one node by key value](#setup-shremlin-get-one-node-by-key-value)
     - [Get all nodes with title containing "even"](#setup-shremlin-get-all-nodes-with-title-containing-even)
     - [Get all nodes with title containing "odd"](#setup-shremlin-get-all-nodes-with-title-containing-odd)
     - [Get all out edges labeled "knows" for one node](#setup-shremlin-get-all-out-edges-labeled-knows-for-one-node)
     - [Get all in edges labeled "studies" for one node](#setup-shremlin-get-all-in-edges-labeled-studies-for-one-node)
   - [Test path](#test-path)
     - [Get all paths with out edge labeled "studies" and then get the head (in) node for one node](#test-path-get-all-paths-with-out-edge-labeled-studies-and-then-get-the-head-in-node-for-one-node)
   - [Test edge directions](#test-edge-directions)
     - [Get all out edges given a node id "1" and edge label "knows"](#test-edge-directions-get-all-out-edges-given-a-node-id-1-and-edge-label-knows)
     - [Get all in edges given a node id "1" and edge label "knows"](#test-edge-directions-get-all-in-edges-given-a-node-id-1-and-edge-label-knows)
     - [Get all both edges given a node id "1" and edge label "knows"](#test-edge-directions-get-all-both-edges-given-a-node-id-1-and-edge-label-knows)
<a name=""></a>
 
<a name="setup-graph"></a>
# Setup graph
<a name="setup-graph-add-10-nodes--10-links-per-node"></a>
## Add 10 nodes & 10 links per node

```js
/**
  * @example
  * // data passed ie { foo: 'bar' } will be indexed
  * graph.addNode('1', { foo: 'bar' });
  *
  * // nodes '2' and '3' will be automatically generated if doesn't exist 
  * graph.addLink('2', '3', 'knows');
  */
var count = 10;
for (var i = 0; i < count; i++) {
  graph.addNode(i + '', {
    title: (i % 2 == 0 ? 'Even better' : 'Odd better')
  });
  for (var j = 0; j < 10; j++) {
    var n = Math.floor((Math.random() * count));
    var label = j % 2 == 0 ? 'likes' : 'studies';
    label = j % 3 == 0 ? 'knows' : label;
    graph.addLink(i + '', n + '', label);
  }
}
```
<a name="setup-graph-add-10-nodes--10-links-per-node-count-nodes"></a>
### Count nodes
should be 10.

```js
/**
  * @example
  * graph.getNodesCount();
  */
var nodesCount = graph.getNodesCount();
nodesCount.should.be.exactly(10);
done();
```

<a name="setup-graph-add-10-nodes--10-links-per-node-count-links"></a>
### Count links
should be 100.

```js
/**
  * @example
  * graph.getLinksCount();
  */
var linksCount = graph.getLinksCount();
linksCount.should.be.exactly(100);
done();
```

<a name="setup-shremlin"></a>
# Setup shremlin

```js
var graph = require('../index')();
var shremlin = require('../lib/lmdb-shremlin-wrap');
var g = shremlin(graph);
```
<a name="setup-shremlin-get-all-vertices"></a>
## Get all vertices
should get back 10 objects.

```js
/**
  * @example
  * g.V()
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
var count = 0;
g.V().forEach(function(err, d, index, cursor, txn) {
  if (err) {
    return done(err);
  }
  if (!d) {
    return done('Item is undefined or null');
  }
  d.should.be.an.Object;
  count++;
});
count.should.be.exactly(10);
done();
```

<a name="setup-shremlin-get-one-node-by-key-value"></a>
## Get one node by key value
should get an object with id == 0 and data object with key named "title".

```js
/**
  * @example
  * g.V('0')
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
function (done) {
  g.V('0').forEach(function(err, d, index, cursor, txn) {
    if (err) {
      return done(err);
    }
    if (!d) {
      return done('Item is undefined or null');
    }
    d.should.be.an.Object.and.containEql({
      id: '0'
    }).and.have.ownProperty('data').and.have.ownProperty('title');
  });
  done();
}
```

<a name="setup-shremlin-get-all-nodes-with-title-containing-even"></a>
## Get all nodes with title containing "even"
should get 5 objects with title == "even".

```js
/**
  * @example
  * g.V({ title: 'even'})
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
var count = 0;
g.V({ title: 'even' }).forEach(function(err, d, index, cursor, txn) {
  if (err) {
    return done(err);
  }
  if (!d) {
    return done('Item is undefined or null');
  }
  d.should.be.an.Object.and.have.ownProperty('data').and.have.ownProperty('title').and
    .match(/even/i);
  count++;
});
count.should.be.exactly(5);
done();
```

<a name="setup-shremlin-get-all-nodes-with-title-containing-odd"></a>
## Get all nodes with title containing "odd"
should get 5 objects with title == "odd".

```js
/**
  * @example
  * g.V({ title: 'odd'})
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
var count = 0;
g.V({ title: 'odd' }).forEach(function(err, d, index, cursor, txn) {
  if (err) {
    return done(err);
  }
  if (!d) {
    return done('Item is undefined or null');
  }
  d.should.be.an.Object.and.have.ownProperty('data').and.have.ownProperty('title').and
    .match(/odd/i);
  count++;
});
count.should.be.exactly(5);
done();
```

<a name="setup-shremlin-get-all-out-edges-labeled-knows-for-one-node"></a>
## Get all out edges labeled "knows" for one node
should get 4 objects with label == "knows".

```js
/**
  * @example
  * g.V('0')
  *  .outE('knows')
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
var count = 0;
g.V('0').outE('knows').forEach(function(err, d, index, cursor, txn) {
  if (err) {
    return done(err);
  }
  if (!d) {
    return done('Item is undefined or null');
  }
  d.should.be.an.Object.and.have.ownProperty('label').and.match(/knows/);
  count++;
});
count.should.be.exactly(4);
done();
```

<a name="setup-shremlin-get-all-in-edges-labeled-studies-for-one-node"></a>
## Get all in edges labeled "studies" for one node
should get 3 objects with label == "knows".

```js
/**
  * @example
  * g.V('1')
  *  .inE('studies')
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
var count = 0;
g.V('1').inE('studies').forEach(function(err, d, index, cursor, txn) {
  if (err) {
    return done(err);
  }
  if (!d) {
    return done('Item is undefined or null');
  }
  d.should.be.an.Object.and.have.ownProperty('label').and.match(/studies/);
  count++;
});
count.should.be.exactly(3);
done();
```

<a name="test-path"></a>
# Test path
<a name="test-path-get-all-paths-with-out-edge-labeled-studies-and-then-get-the-head-in-node-for-one-node"></a>
## Get all paths with out edge labeled "studies" and then get the head (in) node for one node
should get 3 sets of arrays..

```js
/**
  * @example
  * g.V('2')
  *  .outE('studies')
  *  .inV()
  *  .path()
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
var count = 0;
g.V('2').outE('studies').inV().path().forEach(function(err, d, index, cursor, txn) {
  if (err) {
    return done(err);
  }
  if (!d) {
    return done('Item is undefined or null');
  }
  describe('Each item of the array is also an array with exactly 3 items', function() {
    it('should be an Array and have length == 3', function() {
      d.should.be.an.Array.have.lengthOf(3);
    });
  });
  describe('Inspect each item #' + (count + 1) + ' of the path', function() {
    it(
      'should contain itself as first item, contain an edge with label "studies" as second item, and an object for the third item',
      //function(done) {
      function() {
        d.should.match({
          '0': function(it) {
            it.should.be.an.Object.and.have.ownProperty('id').and.eql('2');
          },
          '1': function(it) {
            it.should.be.an.Object.and.have.properties(['fromId', 'toId']).and.have
              .ownProperty('label').and.match(/studies/);
          },
          '2': function(it) {
            it.should.be.an.Object.and.have.ownProperty('id');
          }
        });
        //done();
      });
  });
  count++;
});
count.should.be.exactly(3);
done();
```

<a name="test-edge-directions"></a>
# Test edge directions
<a name="test-edge-directions-get-all-out-edges-given-a-node-id-1-and-edge-label-knows"></a>
## Get all out edges given a node id "1" and edge label "knows"
should have an id that starts with "1:knows".

```js
/**
  * @example
  * g.V('1')
  *  .outE('knows')
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
g.V('1').outE('knows').forEach(function(err, d, index, cursor, txn){
  if (err){
    return(err);
  }
  d.should.be.an.Object.and.have.ownProperty('id').and.match(/^1:knows/i);        
});
done();
```

<a name="test-edge-directions-get-all-in-edges-given-a-node-id-1-and-edge-label-knows"></a>
## Get all in edges given a node id "1" and edge label "knows"
should have an id that ends with "knows:1".

```js
/**
  * @example
  * g.V('1')
  *  .inE('knows')
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
g.V('1').inE('knows').forEach(function(err, d, index, cursor, txn){
  if (err){
    return(err);
  }
  d.should.be.an.Object.and.have.ownProperty('id').and.match(/knows:1$/i);        
});
done();
```

<a name="test-edge-directions-get-all-both-edges-given-a-node-id-1-and-edge-label-knows"></a>
## Get all both edges given a node id "1" and edge label "knows"
should have an id that begins with "1:knows" or ends with "knows:1".

```js
/**
  * @example
  * g.V('1')
  *  .bothE('knows')
  *  .forEach(err, d) {
  *   . . . 
  *  });
  */
g.V('1').bothE('knows').forEach(function(err, d, index, cursor, txn){
  if (err){
    return(err);
  }
  d.should.be.an.Object.and.have.ownProperty('id').and.match(/(^1:knows)|(knows:1$)/i);        
});
done();
```


