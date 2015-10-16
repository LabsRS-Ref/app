var net = require("net");

var server = net.createServer({
    allowHalfOpen: false,
    pauseOnConnect: false
  }, function(client) { //'connection' listener
    console.log('client connected');
    client.on('end', function() {
      console.log('client disconnected');
    });

    client.on('data', function(data) {
      console.log(data.toString());
    });

    var json = {
        command: "setFilterPaths",
        value : [
          "/"
        ]
    };  
    //client.write(JSON.stringify(json));
    //client.pipe(client);
});

server.listen(13286, function() { //'listening' listener
  console.log('server bound');
});
