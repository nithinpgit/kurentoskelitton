var config  = require('./config.js');
var express = require('express');
var app     = express();
var https   = require('https');
var http    = require('http');
var fs      = require('fs');
var socket  = require('socket.io');
var webrtcManager = require('./KurentoWebRtcManager');
var options = {
    key : fs.readFileSync(config.key),
    cert: fs.readFileSync(config.cert)
};
var httpsServer = https.createServer(options,app).listen(config.port);
//var httpServer  = http.createServer(app).listen(config.port);
var io = require('socket.io')(httpsServer);
//var io = require('socket.io')(httpServer);
app.use(express.static('public'));
console.log('KURENTO SINGALING RUNNING : '+config.port);
var manager;
io.on('connection',function(socket){
    socket.on("disconnect", function() { 
          if(socket.presenter){
              manager = null;
          }
    });
     socket.on('message',function(data){
         data = JSON.parse(data);
         switch (data.id) {
             case 'publish':
                 manager = new webrtcManager('classname');
                 manager.startPublishing('streamname',data.sdpOffer,function onIceCallback(err,candidate){
                    socket.emit('onIceCandidate',candidate);
                 },function callBack(err,response){
                     if(err){
                         console.log(err);
                     }
                     socket.emit('onPublishAnswer',response);
                 });
                 socket.presenter = true;
                 break;
            case 'subscribe':
                if(manager){
                   manager.startPlaying('userid',false,'streamname',data.sdpOffer,'userid',function callBack(err,response){
                        if(err){
                            console.log(err);
                            return;
                        }
                        socket.emit('onSubscribeAnswer',response);
                    });
                 }else{
                     socket.emit('onPresenterNotFound');
                 }
                 break;
            case 'publishFromFile':
                manager = new webrtcManager('classname');
                if(manager){
                   manager.publishMediaFromFile('streamname',data.url,function callBack(err,response){
                        if(err){
                            console.log(err);
                            return;
                        }
                        socket.emit('successFileStream',data.url);
                    });
                 }else{
                     console.log('error');
                 }
                 break;
            case 'publishCandidate':
                 if(manager){
                    manager.onPublishingIceCandidate('streamname',data);
                 }else{
                    socket.emit('onPresenterNotFound');
                 }
                 break;
            case 'playCandidate':
                 if(manager){
                    manager.onPlayingIceCandidate('userid',data)
                 }else{
                    socket.emit('onPresenterNotFound');
                 }
                 break;
             default:
                 break;
         }
     })

});