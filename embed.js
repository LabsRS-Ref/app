$(document).ready(function(){
    var rpc = require("ipc");

    rpc.on("contextMenuAction", function(files) {
          $("#board").html( JSON.stringify(files) );
    });

    rpc.on("ipp.UP", function(id, name, icon){
        console.log("UP", [].slice.call(arguments));
        var content = "<div><img src='" + icon + "' /></div>";
        content += "<span>" + name + "</span>";
        $("#devices").html(content);
    });

    rpc.on("ipp.DOWN", function(id){
        console.log("Received ipp.DOWN", id);
    });
});
