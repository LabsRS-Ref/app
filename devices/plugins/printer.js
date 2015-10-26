var ipp = require("ipp");
var util = require("util");
var dns = require("dns");
var mdns = require("mdns");
var request = require('request');
var events = require("events");
var mmm = require('mmmagic');
var pdf_image_pack = require("pdf-image-pack");
var uuid = require("uuid");
var fs = require("fs");
var path = require("path");
var fsextra = require("fs-extra");
var helper = require("../miscs/helper");
var arp = require("../miscs/arp");

var SERVICE_TYPE = "_ipp._tcp.";
var DATA_TMP_DIR = '/var/tmp/edge_ipp';
var PDF_MIME = 'application/pdf';

function __print_job_thunk(cb) {
    return function (err, res) {
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
    } catch (err) {
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
    if (Buffer.isBuffer(data)) {
        var buffer = data;
        __detect_buffer_mime(buffer, function (err, mime) {
            if (err) return console.log(err.red);
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
                        printer.execute("Print-Job", msg, __print_job_thunk(function (err, res) {
                            console.log('Print-Job result', res);
                        }));
                        //clean up
                        fs.unlink(pdf_filename);
                        fs.unlink(img_filename);
                    });
                });
            } else {
                return printer.execute("Print-Job", msg, __printJobThunk(function (err, res) {
                    console.log('Print-Job result', res);
                }));
            }
        });
    } else if (typeof buffer === "string") {
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
                        printer.execute("Print-Job", msg, this.__printJobThunk(function (err, res) {
                            console.log('Print-Job result', res);
                        }));
                    });
                    stream.on('error', function (err) {
                        console.log('received PDF error', err);
                    });
                });
            } else {
                msg['operation-attributes-tag']['document-uri'] = uri;
                printer.execute("Print-URI", msg, this.__printJobThunk(function (err, res) {
                    console.log('Print-Job result', res);
                }));
            }
        });
        return cb();
    }
}

function get_printer_attrs(MAC, printer, ip, service) {
    printer.execute("Get-Printer-Attributes", null, function (err, res) {
        if (res && res.statusCode !== "successful-ok") err = res.statusCode;

        if (err) {
            helper.retry(function () {
                console.log("some error occurs when get ipp info, it will retry it 2 seconds after.".yellow);
                get_printer_attrs(MAC, printer, ip, service);
            }, 2);
            return console.log(err.red);
        }
        else {
            console.log(service);
            var dev = {
                id: MAC,
                name: service.txtRecord.ty,
                icon: helper.try_get(res, "printer-attributes-tag/printer-icons/0"),
                raw: res,
                funcs: {
                    print: function (params) {
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
        }
    });
}

function get_ipp_info(MAC, ip, service) {
    var url = util.format('http://%s:%d/%s', ip
        , service.port, service.txtRecord.rp);
    var printer = ipp.Printer(url);
    if (printer) get_printer_attrs(MAC, printer, ip, service);
}

function device_up_or_down(event, ip, service){
    arp.getMAC(ip, function (code, addr) {
        if (addr && helper.isMAC(addr)) {
            console.log("MAC", addr);
            if (event == 1) { //up
                get_ipp_info(addr, ip, service)

            } else if (event == 0) {
                DeviceManager.unregister("ipp", addr);
            }
        } else {
            helper.retry(function() {
                console.log("some error occurs when get MAC, it will retry it 1 seconds after.".yellow);
                device_up_or_down(event, ip, service);
            }, 1);
        }
    });
}


function event_proxy(event, service) {

    if (!service.host) {
        console.log("Record is broken, need hostname:".red);
        console.log(JSON.stringify(service));
        return;
    }


    dns.lookup(service.host, function (err, ip) {

        if (err) return console.log(err.red);
        console.log((event ? "+" : "-") + " " + service.type + "@" + ip);

        device_up_or_down(event, ip, service);
    });

}

function browseService() {
    var browser = mdns.createBrowser(SERVICE_TYPE);
    browser.on("serviceUp", event_proxy.bind(null, 1));
    browser.on("serviceDown", event_proxy.bind(null, 0));
    browser.on("error", console.log);
    browser.start();
    console.log("STARTING BROWSER - " + SERVICE_TYPE);
    return browser;
}

function init() {
    if (fs.existsSync(DATA_TMP_DIR)) fsextra.removeSync(DATA_TMP_DIR);
    fs.mkdirSync(DATA_TMP_DIR);

    var browser = browseService();

    browser.on("error", function (err) {
        console.log("ERROR".red, err);
    });

    process.on("exit", function () {
        browser.stop();
    });
}

module.exports.init = init;

