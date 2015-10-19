var net = require("net");

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
    if(req.command == "getContextMenuList") {
       var resp = [{
          title: "Example Menu",
          contextMenuItems : [],
          enabled: true,
          iconId: "",
          uuid: "2d91b66c-e01d-4c04-b2cd-c5733b6e36be"
       }];
       var wrapper = {
         command : "menuItems",
         value: JSON.stringify(resp)
       };
       client.end(JSON.stringify(wrapper));
    } else{
       client.end("{}");
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
  client.write("HELLO");
  //client.pipe(client);
});

server.listen(13286, function() { //'listening' listener
  console.log('server bound');
});
