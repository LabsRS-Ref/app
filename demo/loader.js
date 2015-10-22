var fs = require("fs");
var path = require("path");

var plugins = {};

function get_all_plugins(){
        var js = [];
        var pth = path.resolve("./");
        var files = fs.readdirSync(pth);
        files.forEach(function(file){
                if (stat.isFile() && file.substr(-3) === ".js"){
                        res.push(path.join(pth, file));
                }
        });
        return js;
}

function init() {
        var jsfiles = get_all_plugins();
        jsfiles.forEach(function(jsfile) {
                var plugin = require(jsfile);
                var plugin_name = path.basename(jsfile);
                plugin_name = plugin_name.substr(0, plugin_name.length - 3);
                plugins[plugin_name] = plugin;
        });
}

module.exports.init = init;
module.exports.plugins = plugins;
