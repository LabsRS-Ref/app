var util = require('util');
var spawn = require('child_process').spawn;
var ip_regex = "(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)";
var mac_regex = "([0-9a-f]{1,2}[\.:-]){5}([0-9a-f]{1,2})";
/**
 * Read the MAC address from the ARP table.
 *
 * 3 methods for lin/win/mac  Linux reads /proc/net/arp
 * mac and win read the output of the arp command.
 *
 * all 3 ping the IP first without checking the response to encourage the
 * OS to update the arp table.
 *
 *
 */
module.exports.getMAC = function(ipaddress, cb) {
	if(process.platform.indexOf('linux') == 0) {
		exports.readMACLinux(ipaddress, cb);
	}
	else if (process.platform.indexOf('win') == 0) {
		exports.readMACWindows(ipaddress, cb);
	}
	else if (process.platform.indexOf('darwin') == 0) {
		exports.readMACMac(ipaddress, cb);
	}
};

// return  { ["192.168.40.1"] = "6c:b0:ce:f4:b7:d8" }
module.exports.getAllIPAddress = function getAllIPAddresses(cb) {
    if (process.platform.indexOf('linux') === 0) {
        //IP address       HW type     Flags       HW address            Mask     Device
        //192.168.1.1      0x1         0x2         50:67:f0:8c:7a:3f     *        em1
        _get_iptables("cat", ["/proc/net/arp"], cb);
    }
    else if (process.platform.indexOf('win') === 0) {
        //192.168.40.1      6c:b0:ce:f4:b7:d8       static
        _get_iptables("arp", ["-a"], cb);
    }
    else if (process.platform.indexOf('darwin') === 0) {
        //? (192.168.40.1) at 6c:b0:ce:f4:b7:d8 on en1 ifscope [ethernet]
        _get_iptables("arp", ["-an"], cb);
    }
};

/**
 * read from cat /proc/net/arp
 */
module.exports.readMACLinux = function(ipaddress, cb) {

	// ping the ip address to encourage the kernel to populate the arp tables
	var ping = spawn("ping", ["-c", "1", ipaddress ]);

	ping.on('exit', function (code) {
		// not bothered if ping did not work
        _get_iptables("cat", ["/proc/net/arp"], function(err, ip_tables) {
            if(err) return cb(err);
            return cb(undefined, ip_tables[ipaddress]);
        });
	});
};

/**
 * NOT TESTED (I dont have a windows box)
 * read from arp -a 192.168.1.1
 */
module.exports.readMACWindows = function(ipaddress, cb) {

	// ping the ipa ddress to encourage the kernel to populate the arp tables
	var ping = spawn("ping", ["-n", "1", ipaddress ]);

	ping.on('exit', function (code) {
		// not bothered if ping did not work
        _get_iptables("arp", ["-a"], function(err, ip_tables) {
            if(err) return cb(err);
            return cb(undefined, ip_tables[ipaddress]);
        });
	});
};
/**
 * NOT TESTED (I dont have a MAC)
 * read from arp 192.168.1.1
 */
module.exports.readMACMac = function(ipaddress, cb) {

	// ping the ip address to encourage the kernel to populate the arp tables
	var ping = spawn("ping", ["-c", "1", ipaddress ]);

	ping.on('exit', function (code) {
		// not bothered if ping did not work
        _get_iptables("arp", ["-an"], function(err, ip_tables) {
            if(err) return cb(err);
            return cb(undefined, ip_tables[ipaddress]);
        });
	});
};

// return  { ["192.168.40.1"] = "6c:b0:ce:f4:b7:d8" }
function _get_iptables(arp_command, arp_args, cb) {
    console.log(arp_command, arp_args);
    var arp = spawn(arp_command, arp_args);
    var buffer = '';
    var errstream = '';
    arp.stdout.on('data', function (data) {
        buffer += data;
    });
    arp.stderr.on('data', function (data) {
        errstream += data;
    });
    arp.on('close', function(code) {
        if (code != 0) {
            return cb(new Error("Error running arp " + code + " " + errstream));
        }
        var table = buffer.split('\n');
        var res = {};
        for (var l = 0; l < table.length; l++) {
            var parts1 = new RegExp(ip_regex, "gmi").exec(table[l]);
            var parts2 = new RegExp(mac_regex, "gmi").exec(table[l]);
            if(parts1 && parts1.length > 0 && parts2 && parts2.length > 0) {
                res[parts1[0]] = parts2[0];
            }
            else console.log(table[l].red);
        }
        if(res.length > 0)
            return cb(undefined, res);
        return cb(new Error("Count not find ip in arp table."));
    });
}
