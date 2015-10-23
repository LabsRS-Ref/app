module.exports.try_get = function try_get(obj, path) {
        var parts = path.split("/");
        var o = JSON.parse(JSON.stringify(obj));
        for(var i = 0, len = parts.length; i < len; i++) {
                if(o[parts[i]]) o = o[parts[i]];
                else break;
        }
        return o;
}
