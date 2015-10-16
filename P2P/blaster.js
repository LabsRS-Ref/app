// Blaster
// |:|:|:|
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var request = require("request");
var fs = require("fs");
var events = require("events");
var BWorker = (function (_super) {
    __extends(BWorker, _super);
    function BWorker() {
        _super.apply(this, arguments);
        this.cursor = 0;
        this.began = false;
        this._wait = 0;
    }
    BWorker.prototype.wait = function (i) {
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
    };
    BWorker.prototype.running = function () {
        return this.began;
    };
    BWorker.prototype.start = function () {
        var _this = this;
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
        this.req.on("error", function (e) {
            _this.emit("error", e);
            console.log("Blaster Worker Error: ", e);
            _this.stop();
        });
        req.on("data", function (data) {
            if (!_this.began)
                return;
            if (_this.cursor + _this.rangeStart > _this.rangeEnd) {
                _this.stop();
            }
            req.pause();
            _this.wait(1);
            var snapShot = _this.cursor;
            fs.write(_this.fd, data, 0, data.length, _this.rangeStart + _this.cursor, function (err, w, buf) {
                _this.wait(-1);
                if (!_this.began)
                    return;
                if (!err && w !== data.length) {
                    err = new Error("I/O Failed, Data Length Check failed");
                }
                if (err) {
                    _this.emit("error", err);
                    console.log("Blaster IO Error: ", err);
                    _this.cursor = snapShot;
                    _this.req.abort();
                    return _this.stop(err);
                }
                req.resume();
            });
            _this.cursor += data.length;
            _this.emit("progress", _this.cursor, _this.rangeEnd - _this.rangeStart);
        });
        req.on("end", function () {
            console.log("Worker Finished");
            if (!_this.began)
                return;
            _this.stop();
        });
    };
    BWorker.prototype.stop = function (err) {
        var _this = this;
        if (!this.began) {
            return false;
        }
        if (this.req) {
            this.req.abort();
            this.req = undefined;
        }
        this.wait(function () {
            fs.closeSync(_this.fd);
        });
        this.began = false;
        this.emit("end", err);
    };
    return BWorker;
})(events.EventEmitter);
var AirRaid = (function (_super) {
    __extends(AirRaid, _super);
    function AirRaid() {
        _super.apply(this, arguments);
        this.params = {};
        this.workers = [];
        this.began = false;
    }
    AirRaid.prototype.start = function () {
        console.time("Raid * " + this.size);
        if (this.began) {
            return false;
        }
        this.began = true;
        var fd = fs.openSync(this.localpath, "w+");
        fs.ftruncateSync(fd, this.size);
        fs.closeSync(fd);
        var count = Math.floor(Math.pow(this.size / 1024 / 1024, 1 / 2.5)) + 1;
        console.log("AirRaid Ready : ", count);
        var slice = Math.ceil((this.size - 1) / count);
        var prev = 0;
        for (var i = 0; i < count; i++) {
            this.allocateWorker(prev, Math.min(prev + slice, this.size - 1));
            prev = prev + slice;
        }
        return true;
    };
    AirRaid.prototype.allocateWorker = function (rangeStart, rangeEnd, worker) {
        var _this = this;
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
        worker.once("end", function (err) {
            if (err) {
                console.log("working resuming from err point - we should set timeout on this one");
                setTimeout(function () {
                    console.log("worker resume");
                    _this.allocateWorker(worker.cursor + worker.rangeStart, rangeEnd, worker);
                }, 1000);
                return;
            }
            console.log("worker ended! - ", rangeStart, rangeEnd);
            var toHelp;
            var runningCount = 0;
            for (var i = 0; i < _this.workers.length; i++) {
                var w = _this.workers[i];
                if (w == worker)
                    continue;
                if (w.running()) {
                    runningCount++;
                }
                if (w.running() && ((w.rangeEnd - w.rangeStart) - w.cursor > 1024 * 1024 * 2)
                    && (!toHelp || (w.rangeEnd - w.rangeStart) - w.cursor >
                        (toHelp.rangeEnd - toHelp.rangeStart) - toHelp.cursor)) {
                    toHelp = w;
                }
            }
            console.log("worker quit..  remain - #", runningCount);
            if (runningCount == 0) {
                _this.emit("end");
                console.log("Blast Complete");
                console.timeEnd("Raid * " + _this.size);
            }
        });
        worker.once("error", function (e) {
            console.log("worker error!");
        });
        worker.start();
    };
    return AirRaid;
})(events.EventEmitter);
exports.AirRaid = AirRaid;
