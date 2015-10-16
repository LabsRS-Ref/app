// import dgram = require('dgram');
// 
// var i = 0;
// var socket = dgram.createSocket("udp4", (msg, rinfo) => {
// 	i++;
// 		console.log(i);
// 	
// });
// 
// socket.bind(9999);
// 
// process.on("exit", function(){
// 	console.log("final result: ", i);
// });
var net = require('net');
var i = 0;
var socket = net.createServer(function (sock) {
    sock.on('data', function () {
        i++;
        console.log(i);
    });
});
socket.listen(9999);
