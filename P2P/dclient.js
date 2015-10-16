// import dgram = require('dgram');
var net = require('net');
var i = 0;
var socket = net.connect(9999, function () {
    for (var i = 0; i < 1000000; i++) {
        console.log(i);
        socket.write(new Buffer([0, i]));
    }
});
