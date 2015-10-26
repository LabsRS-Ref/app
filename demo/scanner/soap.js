var request = require("request");
var to_json = require("xmljson").to_json;
//var chunked_streams = require('chunking-streams');

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

function _wrap_wscn_streaming_func(uri, xml, write_stream) {
    var req_xml = _SOAP_HEADER + xml + _SOAP_TAIL;
    return function (cb) {
        request({
            uri: uri,
            method: "POST",
            body: req_xml,
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
        })
        .pipe(write_stream);
    };
};

function ScannerSoap(uri) {
    this.uri = uri
}

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

function _retrieve_image_request(uri, jobId, jobToken, write_stream, cb) {
    var xml =
        '<wscn:RetrieveImageRequest>\n' +
        '<wscn:JobId>' + jobId + '</wscn:JobId>\n' +
        '<wscn:JobToken>' + jobToken + '</wscn:JobToken>\n' +
        '</wscn:RetrieveImageRequest>';
    var func = _wrap_wscn_streaming_func(uri, xml, write_stream);
    return func(cb);
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

ScannerSoap.prototype.RetrieveImage = function RetrieveImage(jobId, jobToken, write_stream, cb) {
    _retrieve_image_request(this.uri, jobId, jobToken, write_stream, function (err) {
        if (err) return cb(err);
        return cb(undefined);
    });
};

module.exports = ScannerSoap;


