var g = require('../index')();

var count = 10000; //100K

//Create nodes
var time = process.hrtime(); 
for(var i=0; i < count;i++){
  g.addNode(i+'',{firstName: 'Foo',lastName: 'Bar'});
}
console.log('Elapsed: ' + process.hrtime(time));

//Create links
for(var i=0; i < count;i++){  
  for (var j=0; j < 7;j++){
    var n = Math.floor((Math.random() * count));
    g.addLink(i+'', n+'', 'knows');
  }
}