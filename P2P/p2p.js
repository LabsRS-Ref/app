var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var mdns = require("mdns");
var express = require("express");
var request = require("request");
var events = require("events");
var dns = require("dns");
var fs = require("fs");
var _p = require("path");
var blaster = require("./blaster");
var dgram = require("dgram");
var sendRange = require("send");
var requestIp = require('request-ip');
var progress = require('progress-stream');
var cli = require('cli_debug');
var downloadDir = process.env.HOME + "/Downloads";
cli.debug();
var uuid = require('uuid')();
var myuuid = uuid;
var peerNode = (function (_super) {
    __extends(peerNode, _super);
    function peerNode() {
        _super.apply(this, arguments);
        this.address = undefined;
        this.events = undefined;
        this.eventreq = undefined;
        this.state = -1;
        this.peers = {};
        this.latency = -1;
        this.hops = -1;
        this.port = -1;
        this.auth = undefined;
        this.properties = {};
        this.queuedEvents = [];
        this.mdns = undefined;
        this.contactRetries = 0;
        this.sentFile = {};
    }
    peerNode.prototype.copyObject = function () {
        return {
            address: this.address,
            state: this.state,
            peers: Object.keys(this.peers),
            latency: this.latency,
            hops: this.hops,
            properties: this.properties
        };
    };
    return peerNode;
})(events.EventEmitter);
var peers = {};
var eventHandlers = global["eventHandlers"] = {
    file: function (uuid, blob) {
        console.log("Incoming File * ", blob.name);
        var base = ("http://" + peers[uuid].address + ":" + peers[uuid].port);
        var uri = base + '/fetch_point/' + blob.fetchpoint;
        var body = {
            euid: myuuid,
            auth: peers[uuid].auth
        };
        var t = 1;
        var originPath = downloadDir + "/" + blob.name;
        var path = originPath;
        while (fs.existsSync(path)) {
            path = originPath + (t++);
        }
        console.log(" >>>>> ", path);
        var raid = new blaster.AirRaid();
        raid.localpath = path;
        raid.name = blob.name;
        raid.size = blob.stat.size;
        raid.url = uri;
        raid.params = body;
        raid.start();
        raid.on("end", function () {
            console.log(path, " Transfer Complete");
        });
    }
};
var eventTriggers = global["eventTriggers"] = {
    sendFile: function (uuid, path) {
        if (!fs.existsSync(path)) {
            return console.log("[X]", path + " ENOTFOUND");
        }
        if (!peers[uuid] || peers[uuid].state < 1) {
            return console.log("[X]", uuid + " NOT ALIVE");
        }
        var fileid = require('uuid')();
        peers[uuid].sentFile[fileid] = {
            fetchpoint: fileid,
            path: path,
            stat: fs.statSync(path),
            name: _p.basename(path)
        };
        sendEvent(uuid, 'file', peers[uuid].sentFile[fileid]);
        console.log("File Out!");
    }
};
function recvEvent(uuid) {
    if (!peers[uuid] || peers[uuid].state < 1 || peers[uuid].eventreq)
        return;
    var base = ("http://" + peers[uuid].address + ":" + peers[uuid].port);
    var req = request.post({ uri: base + '/events', body: {
            euid: myuuid,
            auth: peers[uuid].auth
        }, json: true }, function (err, res, b) {
        peers[uuid].eventreq = undefined;
        if (err || (res && res.statusCode !== 200)) {
            if (err) {
                tearDown(uuid, "event socket failure");
            }
            else {
                return recvEvent(uuid);
            }
        }
        else {
            console.log("[e]", uuid, b);
            for (var i = 0; i < b.length; i++) {
                if (eventHandlers[b[i].event]) {
                    eventHandlers[b[i].event](uuid, b[i].data);
                }
                peers[uuid].emit("remote", b[i]);
            }
            return recvEvent(uuid);
        }
    });
    peers[uuid].eventreq = req;
}
function sendEvent(uuid, event, data) {
    var peer = peers[uuid];
    if (!peer)
        return;
    var ev = {
        event: event,
        data: data
    };
    if (peer.events) {
        peer.events.status(200).json([ev]);
        peer.events = undefined;
    }
    else {
        peer.queuedEvents.push(ev);
    }
}
function discoveredPeer(uuid, opts) {
    if (opts === void 0) { opts = {}; }
    if (myuuid === uuid)
        return;
    var peer = peers[uuid] || new peerNode();
    if (peer.state < 1 && opts["state"] == 1) {
        console.log("[+] peer # ", uuid);
    }
    else if (peer.state == 1) {
        process.nextTick(update.bind(null, uuid));
    }
    for (var i in opts) {
        peer[i] = opts[i];
    }
    if (peer.state == -2) {
        peer.state = -1;
    }
    if (!peers[uuid]) {
        peers[uuid] = peer;
    }
    if (peer.state == -1) {
        contact(uuid);
    }
}
function properties() {
    return {};
}
function tearDown(uuid, reason) {
    if (!peers[uuid])
        return;
    console.log("tear down", uuid, reason);
    peers[uuid].state = -1;
    peers[uuid].emit("end");
    if (peers[uuid].events) {
        peers[uuid].events.status(500).json({
            err: 2
        });
        peers[uuid].events = undefined;
    }
    if (peers[uuid].eventreq) {
        peers[uuid].eventreq.abort();
        peers[uuid].eventreq = undefined;
    }
    contact(uuid);
}
function update(uuid) {
    var peer = peers[uuid];
    if (!peer)
        return;
    if (peer.state < 1) {
        return contact(uuid);
    }
    var base = ("http://" + peers[uuid].address + ":" + peers[uuid].port);
    request.post({ uri: base + '/info', body: {
            euid: myuuid,
            auth: peer.auth
        }, json: true }, function (err, res, b) {
        if (err) {
            console.log("Post info Failed", err);
            tearDown(uuid, "Post Info Failed");
        }
        else {
            peer.peers = b.peers;
            peer.properties = b.properties;
            recvEvent(uuid);
        }
    });
}
setInterval(function () {
    for (var i in peers) {
        update(i);
    }
}, 5000);
function badContact(uuid) {
    var peer = peers[uuid];
    if (!peer)
        return;
    peer.contactRetries++;
    if (!peer.mdns || peer.contactRetries >= 5) {
        if (peers[uuid].events) {
            peers[uuid].events.status(500).json({
                err: 2
            });
            peers[uuid].events = undefined;
        }
        if (peers[uuid].eventreq) {
            peers[uuid].eventreq.abort();
            peers[uuid].eventreq = undefined;
        }
        delete peers[uuid];
        console.log("[-] peer # ", uuid);
    }
}
function contact(uuid) {
    var peer = peers[uuid];
    if (!peer)
        return;
    if (peer.state > 0 && peer.auth) {
        return update(uuid);
    }
    var base = ("http://" + peers[uuid].address + ":" + peers[uuid].port);
    request(base + "/perf", function (err, res, body) {
        if (err) {
            return badContact(uuid);
        }
        body = JSON.parse(body);
        if (body.uuid !== uuid) {
            return badContact(uuid);
        }
        request.post({ uri: base + '/register', body: {
                euid: myuuid,
                peers: gatherInfo(),
                properties: properties()
            }, json: true }, function (err, res, body) {
            if (err) {
                return badContact(uuid);
            }
            discoveredPeer(uuid, {
                state: 1,
                auth: body.auth
            });
        });
    });
}
function mdnsDown(uuid) {
    if (!peers[uuid])
        return;
    if (peers[uuid].state == -2) {
        peers[uuid].mdns = undefined;
        peers[uuid].emit("end");
    }
}
function gatherInfo() {
    var p = {};
    for (var i in peers) {
        try {
            p[i] = peers[i].copyObject();
        }
        catch (e) { }
    }
    return p;
}
function mdnsSubsystem(port) {
    console.log("My UUID = ", uuid);
    var adv = new mdns.Advertisement(mdns.tcp("edge-medium-a"), port, {
        name: uuid,
        txtRecord: {
            uuid: uuid
        }
    });
    adv.start();
    var browser = mdns.createBrowser(mdns.tcp("edge-medium-a"));
    browser.on("serviceUp", function (service) {
        var addr = service.addresses[service.addresses.length - 1];
        dns.lookup(service.host, 4, function (err, address) {
            if (!err && address) {
                addr = address;
            }
            discoveredPeer(service.txtRecord.uuid, {
                mdns: service,
                port: service.port,
                address: addr
            });
        });
    });
    browser.on("serviceDown", function (service) {
        if (peers[service.name]) {
            mdnsDown(service.name);
        }
    });
    browser.start();
    process.on("exit", function () {
        browser.stop();
        adv.stop();
    });
}
function setupBlaster(port) {
    var bhub = dgram.createSocket("udp4", function (msg, rinfo) {
    });
    bhub.bind(port);
    console.log("Blaster Listening on ", port);
    return port;
}
function setupHub(port) {
    var app = express();
    var bodyParser = require('body-parser');
    app.get("/perf", function (req, res) {
        res.status(200).json({ uuid: myuuid });
    });
    app.use(bodyParser.json());
    app.use(function (req, res, next) {
        req.body = req.body || {};
        var euid = req.body.euid;
        if (!euid)
            return res.status(502).json({
                err: 0
            });
        req["euid"] = euid;
        req["peer"] = peers[euid];
        req["ip"] = requestIp.getClientIp(req);
        next();
    });
    app.post("/register", function (req, res) {
        var euid = req["euid"];
        if (peers[euid] && peers[euid].state > 0) {
            tearDown(euid, "accepting new connection");
        }
        discoveredPeer(euid, {
            peers: req.body.peers,
            state: 1,
            properties: req.body.properties,
            auth: require("uuid")()
        });
        if (peers[euid]) {
            res.status(200).json({
                auth: peers[euid].auth
            });
        }
        else {
            res.status(502).json({ err: 3 });
        }
    });
    app.use(function (req, res, next) {
        var auth = req.body.auth;
        if (!auth || !req["peer"] || req["peer"].auth !== auth) {
            return res.status(502).json({
                err: 1
            });
        }
        next();
    });
    app.post("/events", function (req, res) {
        var euid = req["euid"];
        if (peers[euid].events) {
            peers[euid].events.status(200).json({
                err: 3
            });
        }
        else {
            if (peers[euid].queuedEvents.length > 0) {
                res.status(200).json(peers[euid].queuedEvents);
                peers[euid].queuedEvents = [];
                return;
            }
        }
        res["setTimeout"](0);
        peers[euid].events = res;
    });
    app.post("/info", function (req, res) {
        res.status(200).json({
            properties: properties(),
            peers: gatherInfo()
        });
    });
    app.use(function (req, res, next) {
        if (req["peer"].state < 1) {
            return res.status(502).json({
                err: 4
            });
        }
        next();
    });
    app.post("/fetch_point/:serve", function (req, res) {
        res["setTimeout"](0);
        var euid = req["euid"];
        var peer = peers[euid];
        var file = peer.sentFile[req.params["serve"]];
        if (!file) {
            return res.status(404).end();
        }
        res.setHeader('Content-Disposition', 'attachment');
        return sendRange(req, file.path)
            .on('error', function (err) {
            console.log("Transfer Aborted", err);
        }).pipe(res);
    });
    app.delete("/fetch_point/:serve", function (req, res) {
        res["setTimeout"](0);
        var euid = req["euid"];
        var peer = peers[euid];
        var file = peer.sentFile[req.params["serve"]];
        if (!file) {
            return res.status(404).end();
        }
        delete peer.sentFile[req.params["serve"]];
        return res.json({
            result: "OK"
        });
    });
    app.listen(port, '::', function () {
        console.log("Hub Server Listening on " + port);
    });
}
require('local-port').findOpen(14000, 15000, function (err, port) {
    setupBlaster(port);
    setupHub(port);
    mdnsSubsystem(port);
});
var send = global["sendTest"] = function sendTest(file) {
    file = file || "/tmp/test";
    for (var i in peers) {
        if (peers[i].state > 0) {
            eventTriggers.sendFile(i, file);
            return;
        }
    }
    console.log("no peer");
};
