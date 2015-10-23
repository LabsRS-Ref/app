var fs = require("fs");
var path = require("path");

function require_all_plugins(){
        var js = [];
        var pth = path.resolve("./plugins");
        var files = fs.readdirSync(pth);
        files.forEach(function(file){
                var file_path = path.join(pth, file);
                var stat = fs.lstatSync(file_path);
                if (stat.isFile() && file.substr(-3) === ".js"){
                        require(file_path);
                }
        });
}

function register_global_funcs(){
        global.Devices = {};
        global.DeviceManager = {};
        global.DeviceManager.register = function register(ns, dev){
                if(ns && dev && dev.id){
                        Devices[ns] = Devices[ns] || {};
                        Devices[ns][dev.id] = {};
                        Devices[ns][dev.id]["name"] = dev.name || "";
                        Devices[ns][dev.id]["icon"] = dev.icon || "";
                        Devices[ns][dev.id]["raw"] = dev.raw || {};
                        Devices[ns][dev.id]["funcs"] = dev.funcs || {};
                }
        };
        global.DeviceManager.unregister = function unregister(ns, id) {
                if(Devices[ns] && Devices[ns][id]) delete Devices[ns][id];
        }
}

function init(){
        console.log("require all plugins...".green);
        require_all_plugins();
        console.log("register global functions...".green);
        register_global_funcs();
}

init();
