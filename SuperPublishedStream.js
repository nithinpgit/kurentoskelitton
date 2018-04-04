/**
 * Created by Isaac on 5/22/17.
 */
const kurento = require('kurento-client');
const PublishStream = require('./PublishedStream');

class SuperPublishedStream {
    constructor(name) {
        this.name = name;
        this.originStream = null;
        this.edgeStreams = {};
        this.userServerMap = {}; //map userID to serverID for fast lookup
        this.candidatesQueue = {};
    }

    startPublishing(originServer, sdpOffer, iceCandidatesCallback, callback) {
        this.originServer = originServer;
        this.originStream = new PublishStream(this.name, this.originServer);
        //origin can be used as one of the edge as well;
        this.edgeStreams[originServer.id] = this.originStream;

        this.originStream.startPublishing(sdpOffer, iceCandidatesCallback, (error, response) => {
            if (!error)
                this._sendQueuedIceCandidates(this.name, this.originStream);
            callback(error, response);
        });
    }

    startPlaying(userID, edgeServer, sdpOffer, iceCandidatesCallback, callback) {
        let stream = this.edgeStreams[edgeServer.id];

        const playBlock = () => {
            this.userServerMap[userID] = edgeServer.id;
            stream.startPlaying(userID, sdpOffer, iceCandidatesCallback, (error, response) => {
                if (!error)
                    this._sendQueuedIceCandidates(userID, stream);

                callback(error, response);
            });
        };

        //for connecting to the origin server, because stream will always exist, so it wont try to do connectEdge
        if (stream)
            playBlock();
        else {
            stream = new PublishStream(this.name + '_' + edgeServer.id, edgeServer);
            this.edgeStreams[edgeServer.id] = stream;
            this.connectEdge(stream, (error) => {
                if (error)
                    callback(error);
                else
                    playBlock();
            });
        }
    }


    startMediaStream(originServer, filePath, callback) {
        this.originServer = originServer;
        this.originStream = new PublishStream(this.name, this.originServer);
        //origin can be used as one of the edge as well;
        this.edgeStreams[originServer.id] = this.originStream;

        this.originStream.startMediaStream(filePath, callback);
    }


    record(callback) {
        this.originStream.record(callback);
    }

    stopRecord(callback) {
        this.originStream.stopRecord(callback);
    }

    pause(callback) {
        this.originStream.pause();
    }


    stopPublishing(callback) {
        //publishing stream is included in the edge
        Object.keys(this.edgeStreams).forEach(key => {
            this.edgeStreams[key].cleanup();
        });

        callback();
    }

    stopPlaying(userID, callback) {
        let server = this.userServerMap[userID];

        if (server) {
            let stream = this.edgeStreams[server];
            if (stream)
                stream.stopPlaying(userID, callback);
        }
    }


    connectEdge(edgeStream, callback) {
        let edge = edgeStream;
        let origin = this.originStream;

        //origin rtc generate offer
        origin.generateOffer(edge.name, (error, candidate) => {
            if (!error)
                edge.onPublishingIceCandidate(candidate);
            else
                console.log('error on ice candidate ', error);
        }, (error, edgeOffer) => {
            if (error)
                callback(error);
            else {
                edge.processOffer(edgeOffer, (error, candidate) => {
                    if (!error)
                        origin.onPlayingIceCandidate(edge.name, candidate);
                    else
                        console.log('error on ice candidate ', error);
                }, (error, answer) => {
                    origin.processAnswer(edge.name, answer, (error) => {
                        callback(error);
                    })
                })
            }
        });
    }


    onPublishingIceCandidate(candidate) {
        if (this.originStream)
            this.originStream.onPublishingIceCandidate(candidate);
        else {
            if (!this.candidatesQueue[this.name]) {
                this.candidatesQueue[this.name] = [];
            }
            this.candidatesQueue[this.name].push(candidate);
        }
    }

    onPlayingIceCandidate(userID, candidate) {
        let stream = this.edgeStreams[this.userServerMap[userID]];
        if (stream)
            stream.onPlayingIceCandidate(userID, candidate);
        else {
            if (!this.candidatesQueue[userID]) {
                this.candidatesQueue[userID] = [];
            }
            this.candidatesQueue[userID].push(candidate);
        }
    }

    _sendQueuedIceCandidates(key, stream) {
        if (this.candidatesQueue[key]) {
            while (this.candidatesQueue[key].length) {
                const candidate = this.candidatesQueue[key].shift();

                if (key === this.name) // publisher
                    stream.onPublishingIceCandidate(candidate);
                else
                    stream.onPlayingIceCandidate(key, candidate);
            }
        }
    };

    _clearCandidatesQueue(key) {
        if (this.candidatesQueue[key]) {
            delete this.candidatesQueue[key];
        }
    };
}


SuperPublishedStream.className = 'superPublishedStream';
module.exports = SuperPublishedStream;