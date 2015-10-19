//VSTP = Very Stupid Transfer Protocol
//it does some STUPID udp thing

import fs = require('fs');
import dgram = require('dgram');
import net = require('net'); 


var fileServed: string[] = []; // <-- le files, max out at 256 files! (ONE-BYTE)



var packetFormatter = {
	
	dataPacket: (fileId, readerId, index, dataBuffer: Buffer) => {
		var buf = new Buffer(1 /* Packet Type */ + 1 /* File Id */ + 1 /* Reader Id */  + 1 /* Index inside Chunk */ + dataBuffer.length);
		buf.writeInt8(1, 0); //TYPE = 1
		buf.writeInt8(fileId, 1); 
		buf.writeInt8(readerId, 2); 
		buf.writeInt8(index, 3);
		dataBuffer.copy(buf, 4); 
		return buf;
	},
	
	chunkRefill: (fileId, readerId, chunkMap: Buffer) => {
		var buf = new Buffer(1 /* Packet Type */ + 1 /* File Id */ + 1 /* Reader Id */  + chunkMap.length);
		buf.writeInt8(2, 0); //TYPE = 1
		buf.writeInt8(fileId, 1);
		buf.writeInt8(readerId, 2);
		chunkMap.copy(buf, 3);
		return buf;
	}
	
}; 

