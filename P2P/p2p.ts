import net = require("net");
import mdns = require("mdns");
import express = require("express");
import request = require("request");
import events = require("events");
import dns = require("dns");
import fs = require("fs");
import _p = require("path");
import blaster = require("./blaster");
import dgram = require("dgram");
var sendRange = require("send");
var requestIp = require('request-ip');
var progress = require('progress-stream');
var cli = require('cli_debug');

var downloadDir = process.env.HOME + "/Downloads";

cli.debug();
const enum errors { 
	missing_euid, 
	missing_auth,
	tear_down, 
	dup_connection,
	offline
}


var uuid = require('uuid')();

var myuuid = uuid;
//this is a node
//it has close neighbors
//it tries to remain connected with near peers
//exchange stuff with its up/downlink socket
//longterm-connection
//heartbeat packet is required to maintain lifespan

//This is pure network-layer stuff :p

class peerNode extends events.EventEmitter {
	address: any = undefined;
	events: any = undefined;
	eventreq: any = undefined;
	state: number = -1;
	peers: { [index: string]: peerNode } = {}; // peer ~ reach
	latency: number = -1;
	hops = -1;
	port = -1;
	auth = undefined;
	properties: any = {};
	queuedEvents = [];
	mdns = undefined;
	contactRetries = 0;
	sentFile = {};
	copyObject() {
		return {
			address: this.address,
			state: this.state,
			peers: Object.keys(this.peers),
			latency: this.latency,
			hops: this.hops,
			properties: this.properties
		};
	}
}

var peers: { [index: string]: peerNode } = <any>{};

var eventHandlers = global["eventHandlers"] =  {
	file: function(uuid, blob){
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
		while(fs.existsSync(path)){
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
		raid.on("end", function(){
			console.log(path, " Transfer Complete");
		});
		// var stream = fs.createWriteStream(path);
		// var str = progress({
		// 	length: blob.stat.size,
		// 	time: 100
		// });
		// str.on('progress', function(progress) {
		// 	console.log(progress.percentage + "%", (progress.speed / 1024) + "kbps");
		// 	/*
		// 	{
		// 		percentage: 9.05,
		// 		transferred: 949624,
		// 		length: 10485760,
		// 		remaining: 9536136,
		// 		eta: 42,
		// 		runtime: 3,
		// 		delta: 295396,
		// 		speed: 949624
		// 	}
		// 	*/
		// });
		// req.pipe(str).pipe(stream);
		// req.on('end', function(){
		// 	console.log("transfer complete");
		// });
		
	}
};


var eventTriggers = global["eventTriggers"] =  {
	sendFile: function(uuid, path) {
		if(!fs.existsSync(path)) {
			return console.log("[X]", path + " ENOTFOUND");
		}
		if(!peers[uuid] || peers[uuid].state < 1) {
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
	if(!peers[uuid] || peers[uuid].state < 1 || peers[uuid].eventreq) return;
	var base = ("http://" + peers[uuid].address + ":" + peers[uuid].port);
	var req = request.post({ uri: base + '/events', body: {
			euid: myuuid,
			auth: peers[uuid].auth
		}, json: true }, (err, res, b) => {
		peers[uuid].eventreq = undefined;
		if (err || (res && res.statusCode !== 200)) {
			if(err){
				tearDown(uuid, "event socket failure");
			} else {
				return recvEvent(uuid);
			}
		} else {
			console.log("[e]", uuid,  b);
			for(var i = 0; i < b.length; i++){
				if(eventHandlers[b[i].event]) {
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
	if (!peer) return;
	var ev = {
		event: event,
		data: data
	};
	if (peer.events) {
		peer.events.status(200).json([ev]);
		peer.events = undefined;
	} else {
		peer.queuedEvents.push(ev);
	}
}


function discoveredPeer(uuid, opts = {}) {
	
	if (myuuid === uuid) return;
	var peer = peers[uuid] || new peerNode();
	
	if(peer.state < 1 && opts["state"] == 1){
		console.log("[+] peer # ", uuid);
	}
	else if(peer.state == 1){
		process.nextTick(update.bind(null, uuid));
	}
	for (var i in opts) {
		peer[i] = opts[i];
	}
	if (peer.state == -2) {
		peer.state = -1; //discovered at least
	}
	if (!peers[uuid]) {
		peers[uuid] = peer;
	}
	
	if (peer.state == -1) {
		//now let's make some noise
		contact(uuid);
	}
}

function properties() {
	return {};
}

function tearDown(uuid, reason) {
	if (!peers[uuid]) return;
	console.log("tear down", uuid, reason);
	peers[uuid].state = -1;
	peers[uuid].emit("end");
	if (peers[uuid].events) {
		peers[uuid].events.status(500).json( {
			err: errors.tear_down
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
	if (!peer) return;
	if (peer.state < 1) {
		return contact(uuid);
	}
	var base = ("http://" + peers[uuid].address + ":" + peers[uuid].port);
	request.post({ uri: base + '/info', body: {
			euid: myuuid,
			auth: peer.auth
		}, json: true }, (err, res, b) => {
		if (err) {
			console.log("Post info Failed", err);
			tearDown(uuid, "Post Info Failed");
		} else {
			peer.peers = b.peers;
			peer.properties = b.properties;
			recvEvent(uuid);
		}
	});
}

setInterval(function(){
	for(var i in peers){
		update(i);
	}
}, 5000);


function badContact(uuid) {
	var peer = peers[uuid];
	if (!peer) return;
	peer.contactRetries++;
	if(!peer.mdns || peer.contactRetries >= 5) {
		if (peers[uuid].events) {
			peers[uuid].events.status(500).json({
				err: errors.tear_down
			});
			peers[uuid].events = undefined;
		}
		if (peers[uuid].eventreq) {
			peers[uuid].eventreq.abort();
			peers[uuid].eventreq = undefined;
		}
		delete peers[uuid];
		console.log("[-] peer # ", uuid)
	}
}

function contact(uuid) {
	// request.post();
	var peer = peers[uuid];
	if (!peer) return;
	if (peer.state > 0 && peer.auth) {
		return update(uuid);
	}
	var base = ("http://" + peers[uuid].address + ":" + peers[uuid].port);
	request(base + "/perf", (err, res, body) => {
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
		}, json: true }, (err, res, body) => {
			if (err) {
				return badContact(uuid);
			}
			discoveredPeer(uuid, {
				state:1,
				auth: body.auth
			});
		});
	});
}


function mdnsDown(uuid) {
	if (!peers[uuid]) return;
	if (peers[uuid].state == -2) { //lost
		peers[uuid].mdns = undefined;
		peers[uuid].emit("end");
	}
}

function gatherInfo() {
	var p = {};
	for (var i in peers) {
		try{
		p[i] = peers[i].copyObject();
		}catch(e){}
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
	browser.on("serviceUp", function(service) {
		var addr = service.addresses[service.addresses.length - 1];
		dns.lookup(service.host, 4, (err, address) => {
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
	browser.on("serviceDown", function(service) {
		if (peers[service.name]) {
			mdnsDown(service.name);
		}
	});

	browser.start();

	process.on("exit", function(){
		browser.stop();
		adv.stop();
	});
}

function setupBlaster(port) {
	var bhub = dgram.createSocket("udp4", (msg, rinfo) => {
		
	});
	bhub.bind(port);
	console.log("Blaster Listening on ", port);
	return port;
}

function setupHub(port) {
	var app = <express.Application>express();
	var bodyParser = require('body-parser');
	//these should be https

	app.get("/perf", function(req, res) {
		res.status(200).json({ uuid: myuuid });
	})

	app.use(bodyParser.json());
	app.use((req, res, next) => {
		//determine peer euid
		req.body = req.body || {};
		var euid = req.body.euid;
		if (!euid) return res.status(502).json({
			err: errors.missing_euid
		});
		req["euid"] = euid;
		req["peer"] = peers[euid];
		req["ip"] = requestIp.getClientIp(req);
		next();
	});

	app.post("/register", (req, res) => {
		var euid = req["euid"];
		if(peers[euid] && peers[euid].state > 0){
		tearDown(euid, "accepting new connection");
		}
			discoveredPeer(euid, {
				peers: req.body.peers,
				state: 1,
				properties: req.body.properties,
				auth: require("uuid")() //this can not be right
			});
			if(peers[euid]){
			res.status(200).json({
				auth: peers[euid].auth
			});
			}else {
				res.status(502).json({err: errors.dup_connection});
			}
	});

	app.use((req, res, next) => {
		//authentication
		var auth = req.body.auth;
		if (!auth || !req["peer"] || req["peer"].auth !== auth) {
			return res.status(502).json({
				err: errors.missing_auth
			});
		}
		next();
	});

	app.post("/events", (req, res) => {
		var euid = req["euid"];
		if (peers[euid].events) {
			peers[euid].events.status(200).json({
				err: errors.dup_connection
			});
		} else {
			if (peers[euid].queuedEvents.length > 0) {
				res.status(200).json(peers[euid].queuedEvents);
				peers[euid].queuedEvents = [];
				return;
			}
		}
		res["setTimeout"](0);
		peers[euid].events = res; //socket mode
	});

	app.post("/info", (req, res) => {
		res.status(200).json({
			properties: properties(),
			peers: gatherInfo()
		});
	});
	
	
	app.use((req, res, next) => {
		//ensure duplex
		if (req["peer"].state < 1) {
			return res.status(502).json({
				err: errors.offline
			});
		}
		next();
	});

	
	// sender ---> (event) ---> fetchpoint_URL
	// recv -<<< - download from  <=| 
	app.post("/fetch_point/:serve", (req, res) => {
		res["setTimeout"](0);
		var euid = req["euid"];
		var peer = peers[euid];
		var file = peer.sentFile[req.params["serve"]];
		if(!file) {
			return res.status(404).end();
		}
		res.setHeader('Content-Disposition', 'attachment');
		//delete peer.sentFile[req.params["serve"]];
		
		return sendRange(req, file.path)
			.on('error', (err)=>{
				console.log("Transfer Aborted", err)
			}).pipe(res);
	});
	
	app.delete("/fetch_point/:serve", (req, res) => {
		res["setTimeout"](0);
		var euid = req["euid"];
		var peer = peers[euid];
		var file = peer.sentFile[req.params["serve"]];
		if(!file) {
			return res.status(404).end();
		}
		delete peer.sentFile[req.params["serve"]];
		return res.json({
			result: "OK"
		});
	});

	app.listen(port, '::', () => {
		console.log("Hub Server Listening on " + port);
	});
}


require('local-port').findOpen(14000, 15000, function(err, port) {
	setupBlaster(port);
	setupHub(port);
	mdnsSubsystem(port);
});



var send = global["sendTest"] = function sendTest(file){
	file = file || "/tmp/test";
	for(var i in peers){
		if(peers[i].state > 0){
			eventTriggers.sendFile(i, file);
			return;
		}
	}
	console.log("no peer");
}
