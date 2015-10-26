var fs = require("fs");
var path = require("path");
var events = require("events");

var emitter = new events.EventEmitter();
process.on("exit", function(){
    emitter.removeAllListeners();
});

function require_all_plugins() {
    var js = [];
    var pth = path.resolve(path.join(process.env.ROOT_PATH,"devices/plugins"));
    var files = fs.readdirSync(pth);
    files.forEach(function (file) {
        var file_path = path.join(pth, file);
        var stat = fs.lstatSync(file_path);
        if (stat.isFile() && file.substr(-3) === ".js") {
            var m = require(file_path);
            if(!m.hasOwnProperty("disabled"))
                m.init();
        }
    });
}

function register_global_funcs() {
    global.Devices = {};
    global.DeviceManager = {};
    global.DeviceManager.register = function register(ns, dev) {
        if (ns && dev && dev.id) {
            Devices[ns] = Devices[ns] || {};
            Devices[ns][dev.id] = {};
            Devices[ns][dev.id]["name"] = dev.name || "";
            Devices[ns][dev.id]["icon"] = dev.icon || "";
            Devices[ns][dev.id]["raw"] = dev.raw || {};
            Devices[ns][dev.id]["funcs"] = dev.funcs || {};

            emitter.emit("UP", ns, dev.id);
        }
    };
    global.DeviceManager.unregister = function unregister(ns, id) {
        emitter.emit("DOWN", ns, id);
        if (Devices[ns] && Devices[ns][id]) delete Devices[ns][id];
    }
}

module.exports.init = function init(channel) {
    console.log("require all plugins...".green);
    require_all_plugins();
    console.log("register global functions...".green);
    register_global_funcs();

    emitter.on("UP", function(ns, id){
        channel.send(ns + ".UP", id, Devices[ns][id].name, Devices[ns][id].icon);
    });
    emitter.on("DOWN", function(ns, id){
        channel.DOWN(ns + ".DOWN", id);
    });
};
module.exports.Events = emitter;
