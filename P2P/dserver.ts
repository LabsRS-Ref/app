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

import net = require('net');

var i = 0;
 
var socket = net.createServer((sock) => {
	sock.on('data', () => {
		i++;
		console.log(i);

	});
});


socket.listen(9999);