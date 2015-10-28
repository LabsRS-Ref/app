var scanner = require("node-wifiscanner");
var arp = require("../miscs/arp");
var fs = require("fs");
var path = require("path");
var fsextra = require("fs-extra");
var dns = require("dns");
var mdns = require("mdns");

var SERVICE_TYPE = "_scanner._tcp.";
var DATA_TMP_DIR = '/var/tmp/edge_scanner';

function device_up_or_down(event, ip, service){
    arp.getMAC(ip, function (code, addr) {
        if (addr) {
            console.log("MAC", addr);
            if (event == 1) { //up
                var dev = {
                    id: addr,
                    name: "",
                    icon: "",
                    raw: service,
                    funcs: {
                    }
                };
                DeviceManager.register("scanner", dev);
            } else if (event == 0) {
                DeviceManager.unregister("scanner", addr);
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

    console.log("service".green ,service);

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
}

module.exports.init = init;
//module.exports.disabled = 1;
