var fs = require('fs');
var lmdbConfig = require('../lib/lmdb-config');
if (!fs.existsSync(lmdbConfig.env.path)) {
  fs.mkdirSync(lmdbConfig.env.path, 0777);
}

//var shremlin = require('ngraph.shremlin');
var graph = require('../index')();

graph.clear();

//var g = shremlin(graph);

var count = 10;
for(var i=0; i < count;i++){
  graph.addNode(i+'', {title: (i % 2 == 0 ? 'Even better' : 'Odd better')});  
  for (var j=0; j < 10;j++){
    var n = Math.floor((Math.random() * count));
    var label = j % 2 == 0 ? 'likes' : 'studies';
    label = j % 3 == 0 ? 'knows' : label;
    graph.addLink(i+'', n+'', label);
  }
}

//graph.forEachNode(console.log);

//graph.forEachLink(console.log);

graph.forEachOutLink(console.log);

//graph.forEachNodeIndex(console.log);



//var nodesCount = graph.getNodesCount(); //10
//var linksCount = graph.getLinksCount(); //100

//get an iterator
//var iter = g.V().out('knows');

//get 1 node
//var next = iter.moveNext();

//see current node
//if (next){
//  next.current();
//}

//g.V().in('likes').out('knows').out('studies').path().forEach(function(path){
  //console.log(path.length)
  //for(var i = 0; i < path.length; ++i) { console.log(path[i].id); }
//});


