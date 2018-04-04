/**
 * Created by Isaac on 1/23/17.
 */

const CachedDictionary = require('./CachedDictionary');
const SuperPublishedStream = (require('./SuperPublishedStream.js'));
const kurento = require('kurento-client');
const AVServerManager = require('./AVServerManager');
const avServerManager = new AVServerManager();

class KurentoWebRtcManager {
    constructor(className) {
        this.className = className;
        // this.kmsURL = 'ws://janus.omnovia-test.com:8888/kurento';
        this.createPublishedStreams();
    }

    startPublishing(streamName, sdpOffer, iceCandidatesCallback, callback) {
        this._initPublishedStream(streamName, (error, stream) => {
            if (error)
                callback(error);
            else {
                this.getOriginServer((error, server) => {
                    console.log('published to  : '+server.ip);
                    if (error)
                        callback(error);
                    else {
                        stream.startPublishing(server, sdpOffer, iceCandidatesCallback, (error, sdpAnswer) => {
                            if (error) {
                                this.publishedStreams.removeItem(stream.name);
                                stream = null;
                            }
                            //console.log(stream.name);
                            const response = error ? {response: 'rejected', message: error} : {
                                response: 'accepted',
                                sdpAnswer: sdpAnswer
                            };

                            callback(error, response);
                        });
                    }
                });
            }
        });
    }

    startPlaying(userID, isOperator, publishedStreamName, sdpOffer, streamUserID, callback) {

        const playBlock = (server, stream) => {
            console.log('subscribing from : '+server.ip);
            stream.startPlaying(userID, server, sdpOffer,
                (error, candidate) => {
                    callback(null, {
                        candidate: candidate,
                        publishedStreamName: publishedStreamName
                    })
                },
                (error, sdpAnswer) => {
                    let response = error ? {response: 'rejected', message: error} : {
                        response: 'accepted',
                        sdpAnswer: sdpAnswer,
                        publishedStreamName: publishedStreamName,
                        streamUserID: streamUserID
                    };
                    //TODO: this is for sending back the response to client
                    callback(null, response);
                });
        };
        this.publishedStreams.getItem(publishedStreamName, (error, publishedStream) => {
            if (isOperator)
                playBlock(publishedStream.originServer, publishedStream);
            else {
                this.getEdgeServer((error, server) => {
                    if (error)
                        callback(error);
                    else
                        playBlock(server, publishedStream);
                });
            }
        });
    };

    record(publishedStreamName, callback) {
        this.publishedStreams.getItem(publishedStreamName, (error, publishedStream) => {
            if (error)
                callback(error);
            else
                publishedStream.record(callback); // will return an recordID
        });
    }

    stopRecord(publishedStreamName, callback) {
        this.publishedStreams.getItem(publishedStreamName, (error, publishedStream) => {
            if (error)
                callback(error);
            else
                publishedStream.stopRecord(callback); // will return an recordID
        });
    }


    stopPlaying(userID, callback) {
        this.publishedStreams.get((error, streams) => {
            Object.keys(streams).forEach(streamName =>{
                let stream = streams[streamName];
                if (stream)
                    stream.stopPlaying(userID, () => {
                    });
            });

            callback();
        });
    }


    getOriginServer(callback) {
        avServerManager.getOrigin(1, callback);//global defined in session
    }

    getEdgeServer(callback) {
        avServerManager.getEdge(1, callback);
    }

    publishMediaFromFile(streamName, filePath, callback) {
        this._initPublishedStream(streamName, (error, stream) => {
            if (stream) {
                this.getOriginServer((error, server) => {
                    console.log('origin server : '+server);
                    stream.startMediaStream(server, filePath, (error) => {
                        console.log('Error:'+error)
                        callback(error, error === null);

                        //enable to test the recover of nodeJS server crashed while there are kurento stream playing
//                    setTimeout(() => {
//                        this.publishedStreams = null;
//                        this.createPublishedStreams();
//                    }, 2000)
                    });
                });
            }
            else
                callback(error, false);
        });
    };
}


KurentoWebRtcManager.prototype._initPublishedStream = function (name, callback) {
    let stream = new SuperPublishedStream(name);
    this.publishedStreams.setItem(name, stream);

    callback(null, stream);
};


KurentoWebRtcManager.prototype.stopStream = function (streamName, callback) {
    this.publishedStreams.getItem(streamName, (error, stream) => {
        let haveAStream = stream !== null;
        if (stream) {
            //console.log('kurento webrtc manager', ' stop and clean up stream ' + streamName);
            stream.stopPublishing((error) => {
                delete this.publishedStreams[streamName];
                stream = null;

                if (callback)
                    callback(null, haveAStream);
            });
        }
        else if (callback)
            callback(null, haveAStream);
    });
};


KurentoWebRtcManager.prototype.pauseStream = function (streamName, callback) {
    this.publishedStreams.getItem(streamName, (error, stream) => {
        let haveAStream = stream !== null;
        if (stream) {
            //console.log('kurento webrtc manager', ' pause stream ' + streamName);

            stream.pause();
        }

        if (callback)
            callback(null, haveAStream);
    });
};

KurentoWebRtcManager.prototype.resumeStream = function (streamName, callback) {
    this.publishedStreams.getItem(streamName, (error, stream) => {
        let haveAStream = stream !== null;
        if (stream) {
            //console.log('kurento webrtc manager', ' resume stream ' + streamName);

            stream.resume();
        }

        if (callback)
            callback(null, haveAStream);
    });
};


KurentoWebRtcManager.prototype.onPublishingIceCandidate = function (streamName, params) {
    this.publishedStreams.getItem(streamName, (error, stream) => {
        if (stream) {
            ////console.log(this.className, 'published stream ' + stream.name + ' provided ice candidate', Log.Level.DEBUG_TWO);
            stream.onPublishingIceCandidate(params.candidate);
        }
    });
};


KurentoWebRtcManager.prototype.onPlayingIceCandidate = function (userID, params) {
    const publishedStreamName = params.publishedStreamName;

    this.publishedStreams.getItem(publishedStreamName, (error, stream) => {
        if (stream) {
            ////console.log(this.className, 'playing stream ' + stream.name + ' provided ice candidate', Log.Level.DEBUG_TWO);
            stream.onPlayingIceCandidate(userID, params.candidate);
        }
    });
};



KurentoWebRtcManager.prototype.cleanup = function () {

    this.publishedStreams.get((error, streams) => {
        streams.forEach(stream => {
            stream.cleanup();
            stream = null;
        });
    });
    this.createPublishedStreams();
};


KurentoWebRtcManager.prototype.createPublishedStreams = function () {
    this.publishedStreams = new CachedDictionary(this.className, 'publishedStreams');
};

module.exports = KurentoWebRtcManager;