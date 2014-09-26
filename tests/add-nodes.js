var g = require('../index')();

var async = require('async');

var count = 10000; //10K

//Create nodes

for (var i = 0; i < count; i++) {
  g.addNode(i + '', {
    firstName: 'Foo',
    lastName: 'Bar'
  });
}


//Create links
for (var i = 0; i < count; i++) {
  for (var j = 0; j < 10; j++) {
    var n = Math.floor((Math.random() * count));
    g.addLink(i + '', n + '', 'knows');
  }
}

var puts = [];
for (var i = 0; i < count; i++) {
  puts.push(i);
}
var time = process.hrtime();

async.eachSeries([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function(q, callback) {
  async.each(puts, function(d, next) {

    async.each([0, 1, 2, 3, 4, 5, 7, 8, 9, 10], function(e, cb) {
      var n = Math.floor((Math.random() * count));
      g.addLink(i + '', n + '', 'knows', cb);
    }, function(err) {
      console.log(d);
      process.nextTick(next);
      //next();
    })
  }, function(err) {
    callback();
  })
}, function(err) {
  console.log('Elapsed: ' + process.hrtime(time));
})
//wget https://raw.githubusercontent.com/rvagg/node-leveldown/master/bench/write-random.js
