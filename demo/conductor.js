var logged = true;
var timer = undefined;
var interval = 10 * 60 * 1000;

function init() {
        if (!logged) return throw new Error("unauthenticated user.");

        timer = setInterval(upload, interval);
}

function upload() {
        //TODO: something about uploading
}

function stop_upload() {
        if(timer) clearInterval(timer);
}

function signin(username, passwd){

        return true;
}
