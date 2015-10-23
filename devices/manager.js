function require_all_plugins(){
        var js = [];
        var pth = path.resolve("./plugins");
        var files = fs.readdirSync(pth);
        files.forEach(function(file){
                if (stat.isFile() && file.substr(-3) === ".js"){
                        require(path.join(pth, file));
                }
        });
}

function register_global_funcs(){
        global.Devices = {};
        global.DeviceManager = {};
        global.DeviceManager.reigster = function register(ns, dev){
                Devices[ns] = Devices[ns] || {};
                Devices[ns][id] = dev.id;
                Devices[ns][id][name] = dev.name || "";
                Devices[ns][id][icon] = dev.icon || "";
                Devices[ns][id][raw] = dev.raw || {};
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
