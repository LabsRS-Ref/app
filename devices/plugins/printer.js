require("colors");
var ipp = require("ipp");
var util = require("util");
var dns = require("dns");
var mdns = require("mdns");
var request = require('request');
var events = require("events");
var cli = require("cli_debug");
var mmm = require('mmmagic');
var pdf_image_pack = require("pdf-image-pack");
var uuid = require("uuid");
var fs = require("fs");
var path = require("path");
var fsextra = require("fs-extra");
var helper = require("../miscs/helper");

var SERVICE_TYPE = "_ipp._tcp.";
var DATA_TMP_DIR = '/var/tmp/edge_ipp';
var PDF_MIME = 'application/pdf';

var emitter = new events.EventEmitter();
var alive = {};
var watch_addr = {};

function __print_job_thunk(cb) {
        return (err, res) => {
            if (err) return cb(err);
            else {
                return cb(undefined, res);
            }
        };
}

function __detect_buffer_mime(buffer, cb) {
        var Magic = mmm.Magic;
        var magic = new Magic(mmm.MAGIC_MIME_TYPE);
        magic.detect(buf, cb);
}

function __blob2PDF(mime, data, cb) {
        try {
                if (mime === 'image/png' || mime === 'image/jpeg') { //exception
                        var img_filename = path.join(DATA_TMP_DIR, uuid());
                        fs.writeFile(img_filename, data, function (err) {
                                if (err) return cb(err);
                                var pdf_filename = path.join(DATA_TMP_DIR, UUIDstr());
                                var opts = {
                                        size: 'legal',
                                        layout: 'portrait'
                                };
                                var slide = new pdf_image_pack(opts);
                                slide.output([img_filename], pdf_filename, function (err2) {
                                        if (err2) return cb(err2);
                                        return cb(undefined, pdf_filename, img_filename);
                                });
                        });
                } else {
                       return cb(new Error('unsupported mime type: ' + mime));
                }
        } catch(err) {
                return cb(err);
        }
}

function __detect_uri_mime(uri, cb) {
        var opts = {};
        opts.url = uri;
        opts.method = 'HEAD';
        opts.gzip = opts.gzip || true;
        opts.headers = {
            'User-Agent': USER_AGENT
        };
        request(opts, function (err, response) {
            var mime = (response.headers && response.headers['content-type']) ? response.headers['content-type'] : 'text/plain';
            return cb(err, mime);
        });
}

function __uri2PDF(uri, cb) {
        var opts = {};
        opts.tmpFolderPath = DATA_TMP_DIR;
        opts.fileName = path.join(DATA_TMP_DIR, uuid());
        return cb(new Error("unsupported print method"));
}

function print(data, service, copies, job_name, user_name) {
        if(Buffer.isBuffer(data)){
                var buffer = data;
                __detect_buffer_mime(buffer, function(err, mime) {
                        if(err) return console.log(err.red);
                        var msg = {
                                "operation-attributes-tag": {
                                    "requesting-user-name": user_name,
                                    "job-name": job_name,
                                    "document-format": mime
                                }
                                , "job-attributes-tag": {
                                    "copies": copies
                                }
                                , data: buffer
                        };
                        var supported = helper.try_get(service, "printer-attributes-tag/document-format-supported");
                        if ((Array.isArray(supported) && supported.indexOf(mime) === -1)
                        || (typeof supported === 'string' && supported !== mime)) {
                                return __blob2PDF(mime, data, function (err, pdf_filename, img_filename) {
                                        if (err) return console.log(err);

                                        fs.readFile(pdf_filename, function (err2, img_data) {
                                                if (err2) return console.log(err2);

                                                msg['data'] = img_data;
                                                msg['operation-attributes-tag']['document-format'] = PDF_MIME;
                                                printer.execute("Print-Job", msg, __print_job_thunk( function(err, res) {
                                                        console.log('Print-Job result', res);
                                                }));
                                                //clean up
                                                fs.unlink(pdf_filename);
                                                fs.unlink(img_filename);
                                        });
                                });
                        } else {
                                return printer.execute("Print-Job", msg, __printJobThunk( function(err, res) {
                                        console.log('Print-Job result', res);
                                }));
                        }
                });
        } else if ( typeof buffer === "string") {
                var uri = buffer;
                var msg = {
                        "operation-attributes-tag": {
                                "requesting-user-name": user_name,
                                "job-name": job_name,
                                "document-format": PDF_MIME
                        }
                        , "job-attributes-tag": {
                                "copies": Number(copies),
                        }
                };
                __detect_uri_mime(uri, function (err, mime) {
                        if (err) return cb(err);
                        if (mime !== PDF_MIME) {
                                __uri2PDF(params.uri, function (err, pdf) {
                                    if (err) return console.log(err);
                                    console.log('PDF total pages ', pdf.numberOfPages);
                                    var bufs = [];
                                    var stream = pdf.stream;
                                    stream.on('data', function (data) {
                                        bufs.push(data);
                                    });
                                    stream.on('end', function () {
                                        msg['data'] = Buffer.concat(bufs);
                                        printer.execute("Print-Job", msg, this.__printJobThunk( function(err, res) {
                                            console.log('Print-Job result', res);
                                        }));
                                    });
                                    stream.on('error', function (err) {
                                        console.log('received PDF error', err);
                                    });
                                });
                         } else {
                                msg['operation-attributes-tag']['document-uri'] = uri;
                                printer.execute("Print-URI", msg, this.__printJobThunk( function(err, res) {
                                    console.log('Print-Job result', res);
                                }));
                         }
                });
                return cb();
        }
}

function get_ipp_info(ip, service){
        var url = util.format('http://%s:%d/%s', ip
                , service.port, service.txtRecord.rp);
        var printer = ipp.Printer(url);
        if(printer) {
                printer.execute("Get-Printer-Attributes", null, function (err, res) {
                        if(err) return console.log(err.red);

                        var dev = {
                                id: ip,
                                name: service.txtRecord.ty,
                                icon: helper.try_get(res, "printer-attributes-tag/printer-icons/0"),
                                raw: res,
                                funcs: {
                                        print: function(params) {
                                                var data = params.data;
                                                var copies = params.copies || 1;
                                                var job_name = params.job_name || uuid();
                                                var user_name = params.user_name || "Anonymous";
                                                return print(data, service, copies, job_name, user_name);
                                        }
                                }
                        };
                        console.log(dev);
                        DeviceManager.register("ipp", dev);
                });
        }
}

function event_proxy(event, service) {
        var s = JSON.stringify(service);
        var typeString = mdns.makeServiceType(service.type).toString();

        if (!service.host) {
                console.log("Record is broken, need hostname:".red);
                console.log(JSON.stringify(service));
                return;
        }
        dns.lookup(service.host,(err, ip, family) => {
                if (err) return console.log(err.red);

                console.log((event ? "+" : "-") + " " + service.type + "@" + ip);
                service.addresses = ip;
                var addr = service.addresses;
                if(Array.isArray(addr)) addr = addr[0];
                if (event == 1) { //up
                    if (!alive[addr]) {
                        alive[addr] = {};
                    }
                    if (!alive[addr][typeString]) {
                        alive[addr][typeString] = {};
                    }
                    alive[addr][typeString][s] = service;
                    //emitter.emit("serviceUp", addr, service);

                    get_ipp_info(ip, service);

                    if (watch_addr[addr]) {
                        watch_addr[addr][0](service, Alive[addr]);
                    }
                } else if (event == 0) {
                    if (Alive[addr] && alive[addr][typeString]) {
                        delete alive[addr][typeString][s];
                        if (Object.keys(Alive[addr][typeString]).length == 0) {
                            delete alive[addr][typeString];
                            if (Object.keys(Alive[addr]).length == 0) {
                                delete alive[addr];
                            }
                        }
                    }
                    DeviceManager.unregister("ipp", ip);
                    //emitter.emit("serviceDown", addr, service);
                    if (watch_addr[addr]) {
                        watch_addr[addr][1](service, Alive[addr]);
                    }
                }
        });
}

function browseService() {
        var browser = mdns.createBrowser(SERVICE_TYPE, {
            resolverSequence: [
                mdns.rst.DNSServiceResolve()
            ]
        });
        browser.on("serviceUp", event_proxy.bind(null, 1));
        browser.on("serviceDown", event_proxy.bind(null, 0));
        browser.on("error", console.log);
        browser.start();
        console.log("STARTING BROWSER - " + SERVICE_TYPE);
        return browser;
}

global["alives"] = function alives(){
        for(var addr in alive) {
                console.log(addr.blue);
                Object.keys(alive[addr]).forEach(function(k){
                        console.log(k.green);
                        console.log(JSON.stringify(alive[addr][k]));
                });
        }
};

function init() {
        if (fs.existsSync(DATA_TMP_DIR)) fsextra.removeSync(DATA_TMP_DIR);
        fs.mkdirSync(DATA_TMP_DIR);

        var browser = browseService();

        browser.on("error", function(err){
                console.log("ERROR".red, err);
        });

        process.on("exit", function(){
        	browser.stop();
                emitter.removeAllListeners();
        });

        cli.debug();
}

init();
