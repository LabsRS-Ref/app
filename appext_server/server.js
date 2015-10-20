var net = require("net");

module.exports.serve = function(channel){
  var server = net.createServer({
    allowHalfOpen: false,
    pauseOnConnect: false
  },
  function(client) { //'connection' listener
    client.setTimeout(2601000);
    client.setNoDelay(true);
    console.log('client connected');
    client.on('end', function() {
      console.log('client disconnected');
    });

    client.on('data', function(data) {
      var str = data.toString();
      var req = JSON.parse(str);
      console.log(str);
      //console.log(req.command, JSON.stringify(req.value));
      if(req.command == "contextMenuAction") {
          channel.send("contextMenuAction", req.value.files)
      }
      client.end("{}");
    });

    client.on('timeout',function(){
      console.log("client was timeout.");
      client.end();
    });

    client.on("error", function (err) {
      console.log("client error:", err);
      client.end();
    });

    client.write("HELLO");
  });

  server.listen(13286, function() { //'listening' listener
    console.log('server bound');
  });
};
