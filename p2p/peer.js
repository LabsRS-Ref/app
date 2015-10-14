var Servent = require('partition.io').Servent,
        servent = new Servent(),
        port = 8888;

    servent.on('listening', function(){
      /**
       * If we aren't on our default port then we weren't
       * the first node, so connect to that one
       */
      if (servent.address().port !== port){
        servent.connect(port);
      }
    });

    /**
     * First bind to our default port, if we can't then use
     * an ephemeral port instead
     */
    servent.on('error', function(err){
      if(err.code === 'EADDRINUSE'){
        servent.listen(0);
      }
    });
    servent.listen(port);
