// import dgram = require('dgram');


// var socket = dgram.createSocket("udp4");

// for(var i = 0; i < 1000000; i++){
// 	socket.send(new Buffer([0, i]), 0, 2, 9999, "localhost", (err, bytes) => {
// 		if(err) console.log(err)
// 		 else {
// 		}
// 	});
// 			console.log(i);
	
// }



import net = require('net');

var i = 0;

var socket = net.connect(9999, ()=>{
	
for(var i = 0; i < 1000000; i++){
	console.log(i);
	socket.write(new Buffer([0, i]));
}
});

