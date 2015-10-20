$(document).ready(function(){

    require("ipc").on("contextMenuAction", function(files) {
          $("#board").html( JSON.stringify(files) );
    });
});
