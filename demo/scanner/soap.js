var request = require("request");
var to_json = require("xmljson").to_json;

var _uri = "";
var _SOAP_HEADER =
    '<?xml version="1.0" encoding="UTF-8"?>'+
    '<SOAP-ENV:Envelope' +
        'xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"'+
        'xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/"'+
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'+
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema"'+
        'xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope"'+
        'xmlns:SOAP-ENC="http://www.w3.org/2003/05/soap-encoding"'+
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'+
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema"'+
        'xmlns:wscn="http://tempuri.org/wscn.xsd"'+
        'xmlns:wsdl="http://tempuri.org/wsdl.xsd">'+
    '<SOAP-ENV:Body SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">';
var _SOAP_TAIL = '</SOAP-ENV:Body></SOAP-ENV:Envelope>';

function _wrap_wscn_func(xml){
    var req_xml = _SOAP_HEADER + xml + _SOAP_TAIL;
    return function(cb) {
        request({
            uri: _uri,
            method: "POST",
            body: new Buffer(req_xml)
        }, function(err, message, response){
            if(err) return cb(err);
            to_json(response, function(err, json){
                if(err) return cb(err);
                return cb(undefined, json);
            });
        });
    };
}

function init(uri) {
    _uri = uri;
}


