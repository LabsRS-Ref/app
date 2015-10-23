
var track = "spotify:track:78twQ5XCFJMTE37ZSU0gsj";

var spotify = require('spotify-node-applescript');

function playTrack(track) {
        spotify.playTrack(track, function(){
            spotify.getState(function(err, state){
                    if(err) { // maybe just started up
                                console.log("try play...");
                                process.nextTick(function() {
                                        playTrack(track);
                                });
                    } else {
                            console.log("playing");
                            spotify.next();
                    }
            });
        });
}

function start(callback) {
        spotify.pause(function() {
                spotify.getState(function(err, state){
                        if(err) { // maybe just started up
                                    console.log("try play...");
                                    process.nextTick(function() {
                                            start(callback);
                                    });
                        } else {

                                spotify.next();
                        }
                });
        });
}

start(function () {
        console.log("playing");
});
