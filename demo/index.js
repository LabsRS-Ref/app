var cli = require("cli_debug");

function load(pth) {
        var m = require(pth);
        if(m.init) m.init();
}

function main(){
        load("./conductor");
        load("./collector");
        load("./render");
        load("./loader");
}

cli.debug();

main();
