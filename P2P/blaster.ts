
// Blaster
// |:|:|:|

import request = require("request");
import http = require("http");
import fs = require("fs");
import events = require("events");

class BWorker extends events.EventEmitter {
	rangeStart: number;
	rangeEnd: number;
	req: request.Request;
	parent: AirRaid;

	cursor: number = 0; //rangeStart + cursor = real.
	fd: number;
	private began = false;

	private _wait = 0;
	private wait(i) {
		if (typeof i === "function") {
			if (this._wait === 0) {
				return i();
			}
			this.once("endio", i);
			return;
		}
		this._wait = this._wait + 1;
		if (this._wait === 0) {
			this.emit("endio");
		}
	}

	running() {
		return this.began;
	}

	start() {
		if (this.began) {
			return false;
		}
		this.began = true;
		var req = request.post({
			uri: this.parent.url,
			body: this.parent.params,
			headers: {
				"Range": "bytes=" + this.rangeStart + "-" + this.rangeEnd
			},
			json: true
		});
		this.req = req;
		this.req.on("error", (e) => {
			this.emit("error", e);
			console.log("Blaster Worker Error: ", e);
			this.stop();
		});
		req.on("data", (data) => {
			//progress
			if (!this.began) return;
			if (this.cursor + this.rangeStart > this.rangeEnd) {
				this.stop(); //done (for dynamic rangeEnds)
			}
			req.pause();
			this.wait(1);
			var snapShot = this.cursor;
			fs.write(this.fd, data, 0, data.length, this.rangeStart + this.cursor, (err, w, buf) => {
				this.wait(-1);
				if (!this.began) return;
				if (!err && w !== data.length) {
					err = new Error("I/O Failed, Data Length Check failed");
				}
				if (err) {
					this.emit("error", err);
					console.log("Blaster IO Error: ", err);
					this.cursor = snapShot;
					this.req.abort();
					return this.stop(err);
				}
				req.resume();
			});
			this.cursor += data.length;
			//console.log((this.rangeStart + this.cursor), "==>", this.rangeEnd);
			this.emit("progress", this.cursor, this.rangeEnd - this.rangeStart);
		});
		req.on("end", () => {
			console.log("Worker Finished");
			if (!this.began) return;
			this.stop();
		});
	}

	stop(err?) {
		if (!this.began) {
			return false;
		}
		if (this.req) {
			this.req.abort();
			this.req = undefined;
		}
		this.wait(() => {
			fs.closeSync(this.fd);
		});
		this.began = false;
		this.emit("end", err);
	}
}

export class AirRaid extends events.EventEmitter {

	name: string;
	localpath: string;
	url: string;
	params: any = {};
	size: number;
	workers: BWorker[] = [];

	began = false;


	start() {
		
		console.time("Raid * " + this.size);
		
		if (this.began) {
			return false;
		}
		this.began = true;
		var fd = fs.openSync(this.localpath, "w+");
		fs.ftruncateSync(fd, this.size);
		fs.closeSync(fd);

		//calculate worker count
		var count = Math.floor(Math.pow(this.size / 1024 / 1024, 1 / 2.5)) + 1;
		console.log("AirRaid Ready : ", count);

		var slice = Math.ceil((this.size - 1) / count);
		//default worker: 4 for test
		var prev = 0;
		for (var i = 0; i < count; i++) {
			this.allocateWorker(prev, Math.min(prev + slice, this.size - 1));
			prev = prev + slice;
		}
		return true;
	}

	private allocateWorker(rangeStart, rangeEnd, worker?: BWorker) {
		if (!worker) {
			worker = new BWorker();
			var id = this.workers.push(worker);
			console.log("allocating Worker #" + id + " @", rangeStart, rangeEnd);
		}
		worker.fd = fs.openSync(this.localpath, "w+");
		worker.rangeStart = rangeStart;
		worker.parent = this;
		worker.rangeEnd = rangeEnd;
		worker.cursor = 0;
		worker.once("end", (err) => {
			if (err) {
				console.log("working resuming from err point - we should set timeout on this one");
				setTimeout(() => {
					console.log("worker resume");
					this.allocateWorker(worker.cursor + worker.rangeStart, rangeEnd, worker);
				}, 1000);
				return;
			}
			console.log("worker ended! - ", rangeStart, rangeEnd); //go & help someone..
			var toHelp: BWorker;
			var runningCount = 0;
			for (var i = 0; i < this.workers.length; i++) {
				var w = this.workers[i];
				if(w == worker) continue;
				if (w.running()) {
					runningCount++;
				}
				if (w.running() && ((w.rangeEnd - w.rangeStart) - w.cursor > 1024 * 1024 * 2)
					&& (!toHelp || (w.rangeEnd - w.rangeStart) - w.cursor >
						(toHelp.rangeEnd - toHelp.rangeStart) - toHelp.cursor)) {
					//GO help him
					toHelp = w;
				}
			}
			//if (!toHelp) {
				//im done!
				console.log("worker quit..  remain - #", runningCount);
				if (runningCount == 0) {
					this.emit("end");
					console.log("Blast Complete");
					console.timeEnd("Raid * " + this.size);
				}
			//	return;
			//} else {
			//	var len = (toHelp.rangeEnd - toHelp.rangeStart) - toHelp.cursor;
			//	var split =  toHelp.cursor + Math.floor(len / 2); //split it 
			//	console.log("working going to help another one..", toHelp.rangeStart + split, toHelp.rangeEnd);
			// 	this.allocateWorker(toHelp.rangeStart + split, toHelp.rangeEnd, worker);
			//	toHelp.rangeEnd = toHelp.rangeStart + split;
			//	return;
			//}
		});
		worker.once("error", (e) => {
			console.log("worker error!");
			//try allocateWorker at this position!!!
		});
		worker.start();
	}

}

