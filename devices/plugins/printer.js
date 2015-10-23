require("colors");
var ipp = require("ipp");
var util = require("util");
var dns = require("dns");
var mdns = require("mdns");
var events = require("events");
var cli = require("cli_debug");

var SERVICE_TYPE = "_ipp._tcp.";

var emitter = new events.EventEmitter();
var alive = {};
var watch_addr = {};

function get_ipp_info(ip, service){
        var url = util.format('http://%s:%d/%s', dev.bus.data.Lease.Address
                , service.port, service.txtRecord.rp);
        var printer = ipp.Printer(ippUrl);
        if(printer) {
                printer.execute("Get-Printer-Attributes", null, function (err, res) {
                        if(err) return console.log(err.red);

                        console.log(res);
                        DeviceManager.register("ipp", res);
                });
        }
}

function event_proxy(event, service) {
        var s = JSON.stringify(service);
        var typeString = mdns.makeServiceType(service.type).toString();

        if (!service.host) {
                console.log("Record is broken, need hostname:".red);
                console.log(JSON.stringify(service));
                return;
        }
        dns.lookup(service.host,(err, ip, family) => {
                if (err) return console.log(err.red);

                console.log((event ? "+" : "-") + " " + service.type + "@" + ip);
                service.addresses = ip;
                var addr = service.addresses;
                if(Array.isArray(addr)) addr = addr[0];
                if (event == 1) { //up
                    if (!alive[addr]) {
                        alive[addr] = {};
                    }
                    if (!alive[addr][typeString]) {
                        alive[addr][typeString] = {};
                    }
                    alive[addr][typeString][s] = service;
                    //emitter.emit("serviceUp", addr, service);

                    get_ipp_info(ip, service);

                    if (watch_addr[addr]) {
                        watch_addr[addr][0](service, Alive[addr]);
                    }
                } else if (event == 0) {
                    if (Alive[addr] && alive[addr][typeString]) {
                        delete alive[addr][typeString][s];
                        if (Object.keys(Alive[addr][typeString]).length == 0) {
                            delete alive[addr][typeString];
                            if (Object.keys(Alive[addr]).length == 0) {
                                delete alive[addr];
                            }
                        }
                    }
                    //emitter.emit("serviceDown", addr, service);
                    if (watch_addr[addr]) {
                        watch_addr[addr][1](service, Alive[addr]);
                    }
                }
        });
}

function browseService() {
        var browser = mdns.createBrowser(SERVICE_TYPE, {
            resolverSequence: [
                mdns.rst.DNSServiceResolve()
            ]
        });
        browser.on("serviceUp", event_proxy.bind(null, 1));
        browser.on("serviceDown", event_proxy.bind(null, 0));
        browser.on("error",(err) => {
            console.log(err);
        });
        browser.start();
        console.log("STARTING BROWSER - " + SERVICE_TYPE);
        return browser;
}

global["alives"] = function alives(){
        for(var addr in alive) {
                console.log(addr.blue);
                Object.keys(alive[addr]).forEach(function(k){
                        console.log(k.green);
                        console.log(JSON.stringify(alive[addr][k]));
                });
        }
};

function init() {
        var browser = browseService();

        browser.on("error", function(err){
                console.log("ERROR".red, err);
        });

        process.on("exit", function(){
        	browser.stop();
                emitter.removeAllListeners();
        });

        cli.debug();
}

init();
