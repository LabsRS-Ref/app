var request = require("request");

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

function probe(uri, cb) {
    var req_xml = _SOAP_HEADER + "<wscn:GetScannerElements></wscn:GetScannerElements>" + _SOAP_TAIL;
    request({
        uri: uri,
        method: "POST",
        body: req_xml,
        timeout: 2000,
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "Content-Length": req_xml.length,
            "SOAPAction": ""
        },
    },
    function (err) {
        return cb(err);
    });
}

var uri = process.argv[2];
probe(uri, function(err){
    console.log(err || "Success");
});

