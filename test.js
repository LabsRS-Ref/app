var arp = require("./arp");
var devices = require("./devices");

//key:IP, value: { mac: MAC, services: { services }, expires: EXPIRES }
var addresses = {};
//key:MAC, value: IP
var mapped = {};

function nowTicks() { return new Date().valueOf(); }

function init(){
        devices.Emitter.on("serviceUp", function(IP, service) {
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

        devices.Emitter.on("serviceDown", function(IP, service) {
                console.log("serviceDown".yellow, IP, addresses[IP].mac);
                delete stations[addresses[IP].mac];
                delete addresses[IP];
        });

        devices.start();
}

init();

module.exports.All = function(){
        return mapped;
}
module.exports.GetServicesByMAC = function (MAC) {
        return addresses[mapped[MAC]];
}

global["stat"] = function stat(){
        for(var MAC in mapped) {
                console.log(MAC.blue);
                console.log(addresses[mapped[MAC]]);
        }
};
