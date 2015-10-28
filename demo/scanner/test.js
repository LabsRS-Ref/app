require("colors");
var ScannerSoap = require("./soap");
var fs = require("fs");

var ip = '192.168.40.37';
var jpg_filepath = "./test.jpeg";

ScannerSoap.Scan(ip, jpg_filepath, function(err) {
    if(err) return console.log(err.red);
    console.log("DONE");
});

//var client = new ScannerSoap(ip, function(err){
//    if(err) return console.log(err.red);
//
//    client.GetScannerStatus(function (err, status) {
//        if (err) throw err;
//        var state = status["ScannerState"];
//        if (state === "Idle") {
//
//            client.CreateJob(function (err, job) {
//                if (err) throw err;
//                var jobId = job.JobId;
//                var jobToken = job.JobToken;
//                if (fs.existsSync(jpg_filepath))
//                    fs.unlinkSync(jpg_filepath);
//
//                client.RetrieveImage(jobId, jobToken, jpg_filepath, function(err){
//                    if(err) return console.log(err.red);
//                    console.log("DONE");
//                });
//            });
//
//        } else {
//            return console.log("Scanner in:", state.red);
//        }
//    });
//});


