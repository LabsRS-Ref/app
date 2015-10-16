var net = require("net");

function respond(c, s){
  c.write(s);
  c.end();
}

var server = net.createServer(function(client) { //'connection' listener
  client.setTimeout(2601000);
  client.setNoDelay(true);
  console.log('client connected');
  client.on('end', function() {
    console.log('client disconnected');
  });

  client.on('data', function(data) {
    var str = data.toString();
    console.log(str);
    var req = JSON.parse(str);
    if(req.command == "getContextMenuList") {
       var resp = {
          title: "Example Menu",
          contextMenuItems : [],
          enabled: true,
          iconId: "",
          uuid: ""
       };
       respond(client, JSON.stringify(resp));
    }
  });

  client.on('timeout',function(){
    console.log("client was timeout.");
    client.end();
  });

  client.on("error", function (err) {
    console.log("client error:", err);
    client.end();
  });

  // var resp = {
  //     command: "setFilterPaths",
  //     value : [
  //       "/"
  //     ]
  // };
  // respond(client, JSON.stringify(resp));
  // client.pipe(client);
});

server.listen(13286, function() { //'listening' listener
  console.log('server bound');
});
