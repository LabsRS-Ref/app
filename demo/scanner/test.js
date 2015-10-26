var ScannerSoap = require("./soap");
var async = require("async");

var uri = 'http://192.168.40.37:8289/';
var client = new ScannerSoap(uri);

var jobs = [];
jobs.push(function(cb){
    client.GetScannerElements(function(err, json){
        console.log("GetScannerElements", err, json);
        cb();
    });
});

//jobs.push(function(cb){
//    client.CreateScanJobRequest(function(err, json){
//        console.log("CreateScanJobRequest", err, json);
//        cb();
//    });
//});

async.series(jobs, console.log);
