//VSTP = Very Stupid Transfer Protocol
//it does some STUPID udp thing
var fileServed = [];
var packetFormatter = {
    dataPacket: function (fileId, readerId, index, dataBuffer) {
        var buf = new Buffer(1 + 1 + 1 + 1 + dataBuffer.length);
        buf.writeInt8(1, 0);
        buf.writeInt8(fileId, 1);
        buf.writeInt8(readerId, 2);
        buf.writeInt8(index, 3);
        dataBuffer.copy(buf, 4);
        return buf;
    },
    chunkRefill: function (fileId, readerId, chunkMap) {
        var buf = new Buffer(1 + 1 + 1 + chunkMap.length);
        buf.writeInt8(2, 0);
        buf.writeInt8(fileId, 1);
        buf.writeInt8(readerId, 2);
        chunkMap.copy(buf, 3);
        return buf;
    }
};
