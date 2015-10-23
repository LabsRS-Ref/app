var debug = require("debug")("edge:hw:info");

var child_process = require("child_process");

function darwin(){
	var sysInfo = child_process.execSync('ioreg -rd1 -c IOPlatformExpertDevice').toString('utf8');

	sysInfo = sysInfo.split("\n");
	sysInfo.pop();
	var dt = {};
	for(var i = 0; i < sysInfo.length; i++){
		var line = sysInfo[i].trim().split('=');
		if(line.length < 2) continue;
		var key = line[0].replace(/\"/g, "").trim();
		var val = line[1].replace(/(\"|\<|\>|\(|\))/g, "").trim();
		dt[key] = val;
	}

	var hostName = child_process.execSync('scutil --get LocalHostName').toString('utf8').trim();
	var uname =  child_process.execSync('uname -a').toString('utf8').trim();
	dt.hostname = hostName;
	dt.uname = uname;
	global.SYSINFO = dt;
	global.UUID = dt.IOPlatformUUID;

	debug(global.SYSINFO);
	debug("DEVICE ID = " + global.UUID);
}

darwin();
