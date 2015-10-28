var scanner = require("node-wifiscanner");
var arp = require("../miscs/arp");
var fs = require("fs");
var path = require("path");
var fsextra = require("fs-extra");
var dns = require("dns");
var mdns = require("mdns");
var soap = require("../miscs/soap");
var uuid = require("uuid");

var SERVICE_TYPE = "_scanner._tcp.";
var DATA_TMP_DIR = '/var/tmp/edge_scanner';
var cached_scanner = {};

function scan_thunk(ip){
    return function(cb) {
        var jpg_path = path.join(DATA_TMP_DIR, uuid() + ".jpeg");
        return soap.Scan(ip, jpg_path, function(err) {
            return cb(err, jpg_path)
        });
    }
}

function device_up_or_down(event, ip, service){
    arp.getMAC(ip, function (err, MAC) {
        if (MAC) {
            console.log("MAC", MAC);
            if (event == 1) { //up
                var dev = {
                    id: MAC,
                    name: service.name,
                    icon: "",
                    raw: service,
                    funcs: {
                        scan: scan_thunk(ip)
                    }
                };
                cached_scanner[ip] = 1;
                DeviceManager.register("scanner", dev);
            } else if (event == 0) {
                delete cached_scanner[ip];
                DeviceManager.unregister("scanner", MAC);
            }
        }
    });
}

function event_proxy(event, service) {
    if (!service.host) {
        console.log("Record is broken, need hostname:".red);
        console.log(JSON.stringify(service));
        return;
    }

    //console.log("service".green ,service);

    dns.lookup(service.host, {
        family: 4,
        hints: dns.ADDRCONFIG | dns.V4MAPPED,
        all: false
    }, function (err, ip) {

        if (err) return console.log(err.red);
        console.log((event ? "+" : "-") + " " + service.type + "@" + ip);

        device_up_or_down(event, ip, service);
    });
}

function browseService() {
    var browser = mdns.createBrowser(SERVICE_TYPE);
    browser.on("serviceUp", event_proxy.bind(null, 1));
    browser.on("serviceDown", event_proxy.bind(null, 0));
    browser.on("error", console.log);
    browser.start();
    console.log("STARTING BROWSER - " + SERVICE_TYPE);
    return browser;
}

function probe_scanner() {

}

function init() {
    if (fs.existsSync(DATA_TMP_DIR)) fsextra.removeSync(DATA_TMP_DIR);
    fs.mkdirSync(DATA_TMP_DIR);

    var browser = browseService();

    browser.on("error", function (err) {
        console.log("ERROR".red, err);
    });

    process.on("exit", function () {
        browser.stop();
    });

    exports.probe();
}

module.exports.init = init;

module.exports.probe = function probe() {
    arp.getAllIPAddress(function(err, ip_tables){
        if(err) return console.log(err.red);

        Object.keys(ip_tables).forEach(function(ip) {
            if(!cached_scanner[ip]) {
                soap.Probe(ip, function(err, is_scanner, result){
                    if(is_scanner) {
                        console.log("Scanner elements:".blue, JSON.stringify(result));
                        var dev = {
                            id: ip_tables[ip],
                            name: result["wscn:ScanElements"]["ScannerInfo"]["ModelNumber"],
                            icon: "",
                            raw: {},
                            funcs: {
                                scan: scan_thunk(ip)
                            }
                        };
                        cached_scanner[ip] = 1;
                        DeviceManager.register("scanner", dev);
                    }
                });
            }
        });
    });
}
//module.exports.disabled = 1;
