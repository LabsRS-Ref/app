require("colors");
var dns = require("dns");
var mdns = require("mdns");
var events = require("events");
var arp = require("./arp");

var emitter = new events.EventEmitter();
var manual = {};
var Alive = {};
var watch_addr = {};
var browser = undefined;

//key:IP, value: { mac: MAC, services: { services }, expires: EXPIRES }
var addresses = {};
//key:MAC, value: IP
var mapped = {};

function nowTicks() { return new Date().valueOf(); }

function eventProxy(event, service) {
        var s = JSON.stringify(service);
        var typeString = mdns.makeServiceType(service.type).toString();

        if (!service.host) {
                console.log("Record is broken, need hostname:".red);
                console.log(JSON.stringify(service));
                return;
        }
        dns.lookup(service.host,(err, ip, family) => {
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
        manual[string_].on("error",(err) => {
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

        browser.start();
}

emitter.on("serviceUp", function(IP, service) {
        var mapping = addresses[IP];
        if( !mapping || (mapping && nowTicks() - mapping.expires >= 300 ) ) { // 5 mintues expired
                addresses[IP] = {
                        services : {},
                        expires : new Date().valueOf()
                };
                console.log("trying to read MAC by:".blue, IP, service.name);
                arp.getMAC(IP, function(err, MAC) {
                        if(err) return console.log(err.red);
                        console.log("UP".green, IP, service.name, MAC.green);
                        if(mapped[MAC] && mapped[MAC] !== IP) // clear phantom data.
                                delete addresses[IP];
                        mapped[MAC] = IP;
                });
        }
        addresses[IP].services[service.type.name] = service;
});

emitter.on("serviceDown", function(IP, service) {
        console.log("serviceDown".yellow, IP, addresses[IP].mac);
        delete stations[addresses[IP].mac];
        delete addresses[IP];
});

module.exports.init = init;


global["stat"] = function stat(){
        for(var MAC in mapped) {
                console.log(MAC.blue);
                console.log(addresses[mapped[MAC]]);
        }
};
