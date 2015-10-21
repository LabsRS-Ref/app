var arp = require("./arp");
var devices = require("./devices");

//key:IP, value: { mac: MAC, services: { services }, expires: EXPIRES }
var addresses = {};

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
                                console.log("UP".green, IP, service.name, MAC);
                                addresses[IP].mac = MAC;
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

module.exports.Addresses = addresses;

global["stat"] = function stat(){
        for(var IP in addresses) {
                console.log(IP.blue);
                console.log(addresses[IP]);
        }
};
