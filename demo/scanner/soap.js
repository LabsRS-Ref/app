require("colors");
var request = require("request");
var to_json = require("xmljson").to_json;
var fs = require("fs");
var path = require("path");
var uuid = require("uuid");

var _SOAP_HEADER =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<SOAP-ENV:Envelope \n' +
    'xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" \n' +
    'xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" \n' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \n' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" \n' +
    'xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" \n' +
    'xmlns:SOAP-ENC="http://www.w3.org/2003/05/soap-encoding" \n' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \n' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" \n' +
    'xmlns:wscn="http://tempuri.org/wscn.xsd" \n' +
    'xmlns:wsdl="http://tempuri.org/wsdl.xsd">\n' +
    '<SOAP-ENV:Body SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\n';
var _SOAP_TAIL = '</SOAP-ENV:Body></SOAP-ENV:Envelope>';

function _wrap_wscn_immediate_func(uri, xml) {
    var req_xml = _SOAP_HEADER + xml + _SOAP_TAIL;
    return function (cb) {
        request({
            uri: uri,
            method: "POST",
            body: req_xml,
            timeout: 2000,
            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                "User-Agent": "gSOAP/2.7",
                "Content-Length": req_xml.length,
                "SOAPAction": ""
            },
        }, function (err, message, response) {
            if (err) return cb(err);
            to_json(response, function (err, json) {
                if (err) return cb(err);

                return cb(undefined, json && json["SOAP-ENV:Envelope"]["SOAP-ENV:Body"]);
            });
        });
    };
};

function _wrap_wscn_streaming_func(uri, xml) {
    var req_xml = _SOAP_HEADER + xml + _SOAP_TAIL;
    return function (onresp, onerr) {
        return request({
            uri: uri,
            method: "POST",
            body: req_xml,
            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                "User-Agent": "gSOAP/2.7",
                "Content-Length": req_xml.length,
                "SOAPAction": ""
            },
        })
            .on("response", onresp)
            .on("error", onerr);
    };
};

function _get_scanner_elements(uri, cb) {
    var xml = '<wscn:GetScannerElements></wscn:GetScannerElements>';
    var func = _wrap_wscn_immediate_func(uri, xml);
    return func(cb);
};

function _create_scan_job_request(uri, cb) {
    var xml =
        '<wscn:CreateScanJobRequest>\n' +
        '<JobIdentifier>Scan Identifier</JobIdentifier>\n' +
        '<DestinationToken>Scan Dest Token</DestinationToken>\n' +
        '<ScanTicket>\n' +
        '<JobDescription>\n' +
        '<JobName>Scan job1</JobName>\n' +
        '<JobOriginationUserName>Scan user1</JobOriginationUserName>\n' +
        '<JobInformation>Scan job info1</JobInformation>\n' +
        '</JobDescription>\n' +
        '<DocumentParameters>\n' +
        '<Format>jfif</Format>\n' +
        '<CompressionQualityFactor>80</CompressionQualityFactor>\n' +
        '<ImagesToTransfer>0</ImagesToTransfer>\n' +
        '<InputSource>Platen</InputSource>\n' +
        '<ContentType>Auto</ContentType>\n' +
        '<InputSize>\n' +
        '<InputMediaSize>\n' +
        '<Width Override="true">8500</Width>\n' +
        '<Height Override="true">11690</Height>\n' +
        '</InputMediaSize>\n' +
        '<DocumentSizeAutoDetect>false</DocumentSizeAutoDetect>\n' +
        '</InputSize>\n' +
        '<Exposure>\n' +
        '<AutoExposure>true</AutoExposure>\n' +
        '<ExposureSettings>true</ExposureSettings>\n' +
        '</Exposure>\n' +
        '<MediaSides>\n' +
        '<MediaFront>\n' +
        '<ScanRegion>\n' +
        '<ScanRegionXOffset UsedDefault="true">0</ScanRegionXOffset>\n' +
        '<ScanRegionYOffset UsedDefault="true">0</ScanRegionYOffset>\n' +
        '<ScanRegionWidth UsedDefault="true">8267</ScanRegionWidth>\n' +
        '<ScanRegionHeight UsedDefault="true">11690</ScanRegionHeight>\n' +
        '</ScanRegion>\n' +
        '<ColorProcessing UsedDefault="true">RGB24</ColorProcessing>\n' +
        '<Resolution>\n' +
        '<Width>300</Width>\n' +
        '<Height>300</Height>\n' +
        '</Resolution>\n' +
        '</MediaFront>\n' +
        '</MediaSides>\n' +
        '</DocumentParameters>\n' +
        '<RetrieveImageTimeout>0</RetrieveImageTimeout>\n' +
        '<ScanManufacturingParameters><DisableImageProcessing>false</DisableImageProcessing></ScanManufacturingParameters>\n' +
        '</ScanTicket>\n' +
        '</wscn:CreateScanJobRequest >';
    var func = _wrap_wscn_immediate_func(uri, xml);
    return func(cb);
};

function _retrieve_image_request(uri, jobId, jobToken, onresp, onerr) {
    var xml =
        '<wscn:RetrieveImageRequest>\n' +
        '<wscn:JobId>' + jobId + '</wscn:JobId>\n' +
        '<wscn:JobToken>' + jobToken + '</wscn:JobToken>\n' +
        '</wscn:RetrieveImageRequest>';
    var func = _wrap_wscn_streaming_func(uri, xml);
    return func(onresp, onerr);
}

function _parse_buffer(data, write_cb) {
    var buffer = data;
    var cursor = 12;
    var version = buffer.readUInt8(0) >> 3;
    var MB = (buffer.readUInt8(0) & 0x04) >> 2;
    var ME = (buffer.readUInt8(0) & 0x02) >> 1;
    var CF = buffer.readUInt8(0) & 0x01;
    var packtype = buffer.readUInt8(0) & 0x07;
    var headtype = buffer.readUInt8(1) >> 4;
    var optionLength = buffer.readUInt16BE(2);
    var afterOptions = cursor + ((optionLength % 4 > 0) ? (4 - (optionLength % 4)) : 0) + optionLength;
    var idLength = buffer.readUInt16BE(4);
    var afterId = ((idLength % 4 > 0) ? (4 - (idLength % 4)) : 0) + afterOptions + idLength;
    var typeLength = buffer.readUInt16BE(6);
    var afterType = ((typeLength % 4 > 0) ? (4 - (typeLength % 4)) : 0) + typeLength + afterId;
    var dataLength = buffer.readUInt32BE(8);
    var afterData = ((dataLength % 4 > 0) ? (4 - (dataLength % 4)) : 0) + afterType + dataLength;
    var data = buffer.slice(afterType, afterData);

    var dataType = buffer.slice(afterId, afterType).toString('utf8');

    if (!MB)
        write_cb(undefined, data, ME);

    return afterData;
}

function _peek_buffer(data) {
    if (data.length >= 12) {
        var cursor = 12;
        var buffer = data;
        var optionLength = buffer.readUInt16BE(2);
        var afterOptions = cursor + ((optionLength % 4 > 0) ? (4 - (optionLength % 4)) : 0) + optionLength;
        var idLength = buffer.readUInt16BE(4);
        var afterId = ((idLength % 4 > 0) ? (4 - (idLength % 4)) : 0) + afterOptions + idLength;
        var typeLength = buffer.readUInt16BE(6);
        var afterType = ((typeLength % 4 > 0) ? (4 - (typeLength % 4)) : 0) + typeLength + afterId;
        var dataLength = buffer.readUInt32BE(8);
        var afterData = ((dataLength % 4 > 0) ? (4 - (dataLength % 4)) : 0) + afterType + dataLength;
        return afterData;
    } else {
        return -1;
    }
}

function ScannerSoap(ip, init_cb) {
    this.uri = "http://" + ip + ":8289/";
    this.Probe(function(err, is_scanner){
        if(!is_scanner) return init_cb(new Error(uri, " has not provide SOAP services."));
        return init_cb();
    });
}

ScannerSoap.prototype.GetScannerStatus = function GetScannerStatus(cb) {
    _get_scanner_elements(this.uri, function (err, result) {
        if (err) return cb(err);
        return cb(undefined, result["wscn:ScanElements"]["ScannerStatus"]);
    });
};

ScannerSoap.prototype.CreateJob = function CreateJob(cb) {
    _create_scan_job_request(this.uri, function (err, job) {
        if (err) return cb(err);
        return cb(undefined, job["wscn:CreateScanJobResponseType"]);
    });
};

ScannerSoap.prototype.RetrieveImage = function RetrieveImage(jobId, jobToken, file_path, cb) {
    return _retrieve_image_request(this.uri, jobId, jobToken,
        function (response) {
            //console.log(response.headers['content-type'].green) // 'image/jpeg'

            var chunked = undefined;
            var offset = 0;
            response.on('data', function (data) {

                if (chunked) {
                    var temp = new Buffer(chunked.length + data.length);
                    chunked.copy(temp, 0, 0, chunked.length);
                    data.copy(temp, chunked.length, 0, data.length);
                    chunked = undefined;
                    data = temp;
                }

                offset = 0;
                while (offset < data.length) {
                    var buf = data.slice(offset);
                    if (_peek_buffer(buf) > buf.length || _peek_buffer(buf) === -1) {
                        chunked = buf;
                        return;
                    }
                    offset = _parse_buffer(buf, function (err, data, end) {
                        if(err) return cb(err);
                        fs.appendFileSync(file_path, data, {encoding: "binary"});
                        if(end === 1) return cb();
                    });
                }
            });
        },
        function (err) {
            return cb(err);
        });
};

ScannerSoap.prototype.Probe = function Probe(cb) {
    _get_scanner_elements(this.uri, function (err) {
        return cb(undefined, !!!err);
    });
};

module.exports = ScannerSoap;

module.exports.Scan = function Scan(ip, file_path, cb) {
    var client = new ScannerSoap(ip, function(err){
        if(err) return cb(err);

        client.GetScannerStatus(function (err, status) {
            if (err) return cb(err);
            var state = status["ScannerState"];
            if (state === "Idle") {

                client.CreateJob(function (err, job) {
                    if (err) throw err;
                    var jobId = job.JobId;
                    var jobToken = job.JobToken;
                    if (fs.existsSync(file_path))
                        fs.unlinkSync(file_path);

                    client.RetrieveImage(jobId, jobToken, file_path, function(err){
                        return cb(err);
                    });
                });

            } else {
                return cb(new Error("Scanner in:" + state));
            }
        });
    });
};


