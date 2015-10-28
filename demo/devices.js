var dns = require("dns");
var mdns = require("mdns");
var events = require("events");
var cli = require("cli_debug");

var emitter = new events.EventEmitter();
var manual = {};
var Alive = {};
var watch_addr = {};
var browser = undefined;

function eventProxy(event, service) {
        var s = JSON.stringify(service);
        var typeString = mdns.makeServiceType(service.type).toString();

        if (!service.host) {
                console.log("Record is broken, need hostname:".red);
                console.log(JSON.stringify(service));
                return;
        }
        dns.lookup(service.host, {
            family: 4,
            hints: dns.ADDRCONFIG | dns.V4MAPPED,
            all: false
        }, function (err, ip){
            if (err) return console.log(err.red);

            //if (!ip) return;
            console.log((event ? "+" : "-") + " " + service.type + "@" + ip);
            service.addresses = ip;
            var addrs = service.addresses;
            if(!Array.isArray(addrs)) addrs = [addrs];
            for (var i = 0; i < addrs.length; i++) {
                var addr = addrs[i];
                if (event == 1) { //up
                    if (!Alive[addr]) {
                        Alive[addr] = {};
                    }
                    if (!Alive[addr][typeString]) {
                        Alive[addr][typeString] = {};
                    }
                    Alive[addr][typeString][s] = service;
                    emitter.emit("serviceUp", addr, service);

                    if (watch_addr[addr]) {
                        watch_addr[addr][0](service, Alive[addr]);
                    }
                }
                else if (event == 0) {
                    if (Alive[addr] && Alive[addr][typeString]) {
                        delete Alive[addr][typeString][s];
                        if (Object.keys(Alive[addr][typeString]).length == 0) {
                            delete Alive[addr][typeString];
                            if (Object.keys(Alive[addr]).length == 0) {
                                delete Alive[addr];
                            }
                        }
                    }
                    emitter.emit("serviceDown", addr, service);
                    if (watch_addr[addr]) {
                        watch_addr[addr][1](service, Alive[addr]);
                    }
                }
            }
        });
}

function browseService(service) {
        var t = service.type;
        if (!t) return;
        var string_ = mdns.makeServiceType(t).toString();
        if (manual[string_]) return;
        manual[string_] = mdns.createBrowser(t, {
            resolverSequence: [
                mdns.rst.DNSServiceResolve()
            ]
        });
        manual[string_].on("serviceUp", eventProxy.bind(null, 1));
        manual[string_].on("serviceDown", eventProxy.bind(null, 0));
        manual[string_].on("error", function (err) {
            console.log(err);
        });
        manual[string_].start();
        console.log("STARTING BROWSER - " + string_);
        return manual[string_];
}

function init() {
        var uuid = require("uuid")();
        var adv = new mdns.Advertisement(mdns.tcp("edge-medium-a"), 15535, {
        	name: uuid,
        	txtRecord: {
        		uuid: uuid
        	}
        });
        adv.start();

        browser = mdns.browseThemAll();
        browser.on("serviceUp", function (service) {
                browseService(service);
        });
        browser.on("error", function(err){
                console.log("ERROR".red, err);
        });

        process.on("exit", function(){
        	browser.stop();
        	adv.stop();
                emitter.removeAllListeners();
        });
}
init();

module.exports.start = function(){
        browser.start();
};
module.exports.stop = function(){
        browser.stop();
};
module.exports.Alive = Alive;
module.exports.Emitter = emitter;

cli.debug();
global["alives"] = function alives(){
        for(var addr in Alive) {
                console.log(addr.blue);
                Object.keys(Alive[addr]).forEach(function(k){
                        console.log(k.green);
                        console.log(JSON.stringify(Alive[addr][k]));
                });
        }
};
