var request = require("request");
var to_json = require("xmljson").to_json;

var _SOAP_HEADER =
    '<?xml version="1.0" encoding="UTF-8"?>\n'+
    '<SOAP-ENV:Envelope \n' +
        'xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" \n'+
        'xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" \n'+
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \n'+
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema" \n'+
        'xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" \n'+
        'xmlns:SOAP-ENC="http://www.w3.org/2003/05/soap-encoding" \n'+
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \n'+
        'xmlns:xsd="http://www.w3.org/2001/XMLSchema" \n'+
        'xmlns:wscn="http://tempuri.org/wscn.xsd" \n'+
        'xmlns:wsdl="http://tempuri.org/wsdl.xsd">'+
    '<SOAP-ENV:Body SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\n';
var _SOAP_TAIL = '</SOAP-ENV:Body></SOAP-ENV:Envelope>';

_wrap_wscn_func = function _wrap_wscn_func(uri, xml){
    var req_xml = _SOAP_HEADER + xml + _SOAP_TAIL;
    console.log(req_xml)
    return function(cb) {
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
        }, function(err, message, response){
            if(err) return cb(err);
            to_json(response, function(err, json){
                if(err) return cb(err);

                return cb(undefined, json && json["SOAP-ENV:Envelope"]["SOAP-ENV:Body"]);
            });
        });
    };
}

function ScannerSoap(uri){
    this.uri = uri
}

ScannerSoap.prototype.GetScannerElements = function GetScannerElements(cb) {
    var xml = '<wscn:GetScannerElements></wscn:GetScannerElements>';
    var func = _wrap_wscn_func(this.uri, xml);
    return func(cb);
};

ScannerSoap.prototype.CreateScanJobRequest = function CreateScanJobRequest(cb) {
    var xml =
        '<wscn:CreateScanJobRequest>' +
            '<JobIdentifier>Scan Identifier</JobIdentifier>'+
            '<DestinationToken>Scan Dest Token</DestinationToken>'+
            '<ScanTicket>'+
                '<JobDescription>'+
                    '<JobName>Scan job1</JobName>'+
                    '<JobOriginationUserName>Scan user1</JobOriginationUserName>'+
                    '<JobInformation>Scan job info1</JobInformation>'+
                '</JobDescription>'+
                '<DocumentParameters>'+
                    '<Format>jfif</Format>'+
                    '<CompressionQualityFactor>80</CompressionQualityFactor>'+
                    '<ImagesToTransfer>0</ImagesToTransfer>'+
                    '<InputSource>Platen</InputSource>'+
                    '<ContentType>Auto</ContentType>'+
                    '<InputSize>'+
                        '<InputMediaSize>'+
                            '<Width Override="true">8500</Width>'+
                            '<Height Override="true">11690</Height>'+
                        '</InputMediaSize>'+
                        '<DocumentSizeAutoDetect>false</DocumentSizeAutoDetect>'+
                    '</InputSize>'+
                    '<Exposure>'+
                        '<AutoExposure>true</AutoExposure>'+
                        '<ExposureSettings>true</ExposureSettings>'+
                    '</Exposure>'+
                    '<MediaSides>'+
                        '<MediaFront>' +
                            '<ScanRegion>'+
                                '<ScanRegionXOffset UsedDefault="true">0</ScanRegionXOffset>'+
                                '<ScanRegionYOffset UsedDefault="true">0</ScanRegionYOffset>'+
                                '<ScanRegionWidth UsedDefault="true">8267</ScanRegionWidth>'+
                                '<ScanRegionHeight UsedDefault="true">11690</ScanRegionHeight>'+
                            '</ScanRegion>'+
                            '<ColorProcessing UsedDefault="true">RGB24</ColorProcessing>'+
                            '<Resolution>'+
                                '<Width>300</Width>'+
                                '<Height>300</Height>'+
                            '</Resolution>'+
                        '</MediaFront>'+
                    '</MediaSides>'+
                '</DocumentParameters>'+
                '<RetrieveImageTimeout>0</RetrieveImageTimeout>'+
                '<ScanManufacturingParameters><DisableImageProcessing>false</DisableImageProcessing></ScanManufacturingParameters>'+
            '</ScanTicket>'+
        '</wscn:CreateScanJobRequest >';
    var func = _wrap_wscn_func(this.uri, xml);
    return func(cb);
};

module.exports = ScannerSoap;


