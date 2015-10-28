$(document).ready(function(){
    var rpc = require("ipc");
    var path = require("path");
    var fs = require("fs");

    rpc.on("contextMenuAction", function(files) {
          $("#board").html( JSON.stringify(files) );
    });

    rpc.on("ipp.UP", function(id, name, icon){
        console.log("UP", [].slice.call(arguments));
        var content = `
            <div><img src="${icon}" /></div>
            <span>${name}</span>`;
        $("#devices").html(content);
    });

    rpc.on("ipp.DOWN", function(id){
        console.log("Received ipp.DOWN", id);
    });

    window.scan = function(id) {
        console.log("window.scan", rpc, id);
        rpc.send("scan", id);
    }

    rpc.on("scan.done", function(id, file_path){
        console.log(id, file_path);
        //if(file_path && fs.existsSync(file_path))
        $("#preview").attr("src", file_path);
    });

    rpc.on("scanner.UP", function(id, name, icon) {
        icon = path.join(process.env.ROOT_PATH, "/assets/images/scanner.jpg");
        var content = `
            <div><img src="${icon}" /></div>
            <span>${name}</span>
            <div><button onclick=scan("${id}");>Scan</button></div>`;
        $("#devices").html(content);
    });

    rpc.on("scanner.DOWN", function(id) {
        console.log("Received scanner.DOWN", id);
    });
});
