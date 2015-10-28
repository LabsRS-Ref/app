require("colors");
var ScannerSoap = require("./soap");
var fs = require("fs");
var binary = require("binary");

var uri = 'http://192.168.40.37:8289/';
var jpg_filepath = "./test.jpeg";
var client = new ScannerSoap(uri);

//var types = {};

function parseBuffer(data, cb) {
    var buffer = data;
    var cursor = 12;
    var version = buffer.readUInt8(0) >> 3;
    var MB = (buffer.readUInt8(0) & 0x04) >> 2;
    var ME = (buffer.readUInt8(0) & 0x02) >> 1;
    var CF = buffer.readUInt8(0) & 0x01;
    var packtype = buffer.readUInt8(0) & 0x07;
    var headtype = buffer.readUInt8(1) >> 4;
    var optionLength = buffer.readUInt16BE(2);
    var afterOptions = cursor + ((optionLength % 4 > 0) ? (4 - (optionLength % 4)) : 0) + optionLength;
    var idLength = buffer.readUInt16BE(4);
    var afterId = ((idLength % 4 > 0) ? (4 - (idLength % 4)) : 0) + afterOptions + idLength;
    var typeLength = buffer.readUInt16BE(6);
    var afterType = ((typeLength % 4 > 0) ? (4 - (typeLength % 4)) : 0) + typeLength + afterId;
    var dataLength = buffer.readUInt32BE(8);
    var afterData = ((dataLength % 4 > 0) ? (4 - (dataLength % 4)) : 0) + afterType + dataLength;
    var data = buffer.slice(afterType, afterData);

    //var dataType = buffer.slice(afterId, afterType).toString('utf8');
    //if(!types[dataType]) {
    //    console.log(`
    //            version = ${version}
    //            FLAG = ${MB} ${ME} ${CF}
    //            packtype = ${packtype}
    //            headtype = ${headtype}
    //            optionLength = ${optionLength}
    //            idLength = ${idLength}
    //            typeLength = ${typeLength}
    //            dataLength = ${dataLength}
    //            options = ${ buffer.slice(cursor, afterOptions).toString('utf8') }
    //            id = ${ buffer.slice(afterOptions, afterId).toString('utf8') }
    //            type = ${ dataType }
    //        `);
    //    types[dataType] = 1;
    //}

    if (!MB)
        cb(data);

    return afterData;
}

function peekBuffer(data) {
    if (data.length >= 12) {
        var cursor = 12;
        var buffer = data;
        var optionLength = buffer.readUInt16BE(2);
        var afterOptions = cursor + ((optionLength % 4 > 0) ? (4 - (optionLength % 4)) : 0) + optionLength;
        var idLength = buffer.readUInt16BE(4);
        var afterId = ((idLength % 4 > 0) ? (4 - (idLength % 4)) : 0) + afterOptions + idLength;
        var typeLength = buffer.readUInt16BE(6);
        var afterType = ((typeLength % 4 > 0) ? (4 - (typeLength % 4)) : 0) + typeLength + afterId;
        var dataLength = buffer.readUInt32BE(8);
        var afterData = ((dataLength % 4 > 0) ? (4 - (dataLength % 4)) : 0) + afterType + dataLength;
        return afterData;
    } else {
        return -1;
    }
}


client.GetScannerStatus(function (err, status) {
    if (err) throw err;
    var state = status["ScannerState"];
    if (state === "Idle") {

        client.CreateJob(function (err, job) {
            if (err) throw err;
            var jobId = job.JobId;
            var jobToken = job.JobToken;
            if (fs.existsSync(jpg_filepath))
                fs.unlinkSync(jpg_filepath);

            client.RetrieveImage(jobId, jobToken,
                function (response) {
                    console.log(response.headers['content-type'].green) // 'image/png'

                    var chunked = undefined;
                    var offset = 0;
                    response.on('data', function (data) {

                        if (chunked) {
                            var temp = new Buffer(chunked.length + data.length);
                            chunked.copy(temp, 0, 0, chunked.length);
                            data.copy(temp, chunked.length, 0, data.length);
                            chunked = undefined;
                            data = temp;
                        }

                        offset = 0;
                        while (offset < data.length) {
                            var buf = data.slice(offset);
                            if (peekBuffer(buf) > buf.length || peekBuffer(buf) == -1) {
                                chunked = buf;
                                return;
                            }
                            offset = parseBuffer(buf, function (data) {
                                fs.appendFileSync(jpg_filepath, data, {encoding: "binary"});
                            });
                        }
                    });
                },
                function (err) {
                    console.log("error", err.red);
                })
            //.pipe(fs.createWriteStream("compare.jpeg"));
        });

    } else {
        return console.log("Scanner in:", state.red);
    }
});
