require("colors");
var ScannerSoap = require("./soap");
var fs = require("fs");
var binary = require("binary");

var uri = 'http://192.168.40.37:8289/';
var jpg_filepath = "./test.jpeg";
var client = new ScannerSoap(uri);

client.GetScannerStatus(function(err, status){
    if(err) throw err;
    var state = status["ScannerState"];
    if(state === "Idle"){

        client.CreateJob(function(err, job) {
            if(err) throw err;
            var jobId = job.JobId;
            var jobToken = job.JobToken;
            if(fs.existsSync(jpg_filepath))
                fs.unlinkSync(jpg_filepath);

            client.RetrieveImage(jobId, jobToken,
                function(response) {
                    console.log(response.statusCode.green) // 200
                    console.log(response.headers['content-type'].green) // 'image/png'

                    var first = true;
                    var curr_pos = 0;
                    var offset = 0;
                    var found = false;
                    response.on('data', function(data) {
                        if(!found) {

                        }

                        var vars = binary
                            .parse(data)
                            .word16bu("id_header")
                            .word16bu("type_header")
                            .word32bu("data_length")
                            .vars;
                        var id_length = vars.id_header & 8191;
                        var type_length = vars.type_header & 8191;
                        var mb = id_length & 32768;
                        var me = id_length & 16384;
                        var cf = id_length & 8192;

                        if(first) {
                            console.log("mb", mb, "me", me, "cf", cf);
                            console.dir(vars);
                            console.log(vars.id_header.toString(2));
                            console.log(vars.type_header.toString(2));
                            // https://msdn.microsoft.com/en-us/library/aa480488.aspx

                            var data_length = vars.data_length;
                            offset = 564;
                                // 64 + id_length / 8 + type_length / 8;
                            console.log("offset".blue, offset, "data length".blue, data_length);
                            //console.log("id", data.slice(8, 8 + id_length).toString());
                            first = false;
                        }

                        if((curr_pos + data.length) >= offset && offset >= curr_pos) {
                            var relat_offset = (offset - curr_pos);
                            console.log(relat_offset.toString().blue);
                            fs.appendFileSync(jpg_filepath, data.slice(relat_offset));
                        } else if (curr_pos > offset) {
                            fs.appendFileSync(jpg_filepath, data);
                        }

                        curr_pos += data.length;
                    });
                },
                function(err){
                    console.log("error", err.red);
                })
                //.pipe(fs.createWriteStream("compare.jpeg"));
        });

    } else {
        return console.log("Scanner in:", state.red);
    }
});
