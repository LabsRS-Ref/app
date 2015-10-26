var ScannerSoap = require("./soap");
var fs = require("fs");

var uri = 'http://192.168.40.37:8289/';
var client = new ScannerSoap(uri);

client.GetScannerStatus(function(err, status){
    if(err) throw err;
    var state = status["ScannerState"];
    if(state === "Idle"){

        client.CreateJob(function(err, job) {
            if(err) throw err;
            var jobId = job.JobId;
            var jobToken = job.JobToken;
            var writeStream = fs.createWriteStream("./test.jpg");

            client.RetrieveImage(jobId, jobToken, writeStream, function(err){
                console.log(err);
            });

        });

    } else {
        throw new Error(state)
    }
});
