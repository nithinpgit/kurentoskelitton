/**
 * Created by Isaac on 1/23/17.
 */
const kurento = require('kurento-client');
const CachedDictionary = require('./CachedDictionary');

const NOCACHE = true;
const VIDEO_MEDIA_TYPE = 'MP4'; // [WEBM|MP4|WEBM_VIDEO_ONLY|WEBM_AUDIO_ONLY|MP4_VIDEO_ONLY|MP4_AUDIO_ONLY|JPEG_VIDEO_ONLY|KURENTO_SPLIT_RECORDER]
const AUDIO_MEDIA_TYPE = 'MP3'; // [WEBM|MP4|WEBM_VIDEO_ONLY|WEBM_AUDIO_ONLY|MP4_VIDEO_ONLY|MP4_AUDIO_ONLY|JPEG_VIDEO_ONLY|KURENTO_SPLIT_RECORDER]
const BASE_RECORDING_PATH = 'file:///tmp/';
const VIDEO_RECORDING_PATH = BASE_RECORDING_PATH + 'videos/';
const AUDIO_RECORDING_PATH = BASE_RECORDING_PATH + 'audios/';
const kurentoElement = {
    PIPE_LINE : 'MediaPipeline',
    WEBRTC_ENDPOINT : 'WebRtcEndpoint',
    RECORDER_ENDPOINT : 'RecorderEndpoint',
    PLAYER_ENDPOINT : 'PlayerEndpoint'
};

class PublishedStream {
    
    constructor(name, avServer)
    {
        this.name = name;
        this.server = avServer;
        this.kurentoClient = avServer.kurentoClient;
        this.publishWebRtcEndpoint = null;
        this.playWebRtcEndpoints = {};
        this.recordWebrtcEndpoint = null;
        this.pipeline = null;
        this.candidatesQueue = {};
        this.hasVideo = true; //default has video

        this.cachedIDs = new CachedDictionary(PublishedStream.className, name);
    }

    isRecording()
    {
        return this.recordWebrtcEndpoint !== null;
    }

    startPublishing(sdpOffer, iceCandidatesCallback, callback)
    {
        this._getPublishWebRtcEndpoint(true, {}, iceCandidatesCallback, (error, webrtcEndpoint) =>{
            if(error)
                callback(error);
            else
            {
                webrtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer)=>{
                    //this needs to be after we process the offer
                    webrtcEndpoint.gatherCandidates((error) => {

                    });

                    callback(error, sdpAnswer);
                });
            }
        })
    }

    
    startMediaStream(filePath, callback)
    {
        var self            = this;
        var fileKey         = 'b.mp4';
        var fs = require('fs');
        var path = require('path');
        var AWS = require('aws-sdk');
        AWS.config.update(
        {
            accessKeyId: "AKIAI3N2DR5YG5G72UAA",
            secretAccessKey: "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",
            region: 'us-west-1'
        }
        );
        var s3 = new AWS.S3();
        var opt = {
            Bucket    : '/uploadsflow',
            Key    : fileKey,
        };
        var fileStream = s3.getObject(opt).createReadStream();
        var file = fs.createWriteStream(fileKey);
        fileStream.pipe(file);
        file.on('finish', function() {
                let localPath = path.resolve(__dirname, file.path);
                let options = {uri:localPath};
                console.log(JSON.stringify(options));
                self._getPublishWebRtcEndpoint(false, options, null, (error)=>{
                    callback(error, null);
                });
        });
       
    }


    startPlaying(userID, sdpOffer, iceCandidatesCallback, callback)
    {
        // this._clearCandidatesQueue(userID);

        this._getViewerWebrtcEndpoint(iceCandidatesCallback, (error, viewerWebrtcEndpoint)=>{
            if(error)
                callback(error);
            else
            {
                this._setPlayWebRtcEndpoint(userID, viewerWebrtcEndpoint);

                viewerWebrtcEndpoint.processOffer(sdpOffer, (error, sdpAnswer) => {
                    if(error)
                        callback(error);
                    else
                        this._connectPlayerToPublisher(viewerWebrtcEndpoint, (error)=>{
                            if(error)
                                callback(error);
                            else
                            {
                                callback(null, sdpAnswer);
                            }
                        });
                });
            }
        });
    }


    _connectPlayerToPublisher(playerEndpoint, callback)
    {
        //must have it already, so no need to pass icecandidate to _getPublishWebRtcEndpoint
        this._getPublishWebRtcEndpoint(true, null, null, (error, publishWebrtcEndpoint)=>{
            if(error)
                callback(error);
            else
            {
                publishWebrtcEndpoint.connect(playerEndpoint, (error) => {
                    if(error)
                        callback(error);
                    else
                    {
                        playerEndpoint.gatherCandidates((error) => {
                        });

                        callback();
                    }
                });
            }
        });
    }


    _getViewerWebrtcEndpoint(iceCandidateCallback, callback)
    {
        this._getPipeline((error, pipeline) => {
            if (error)
                callback(error);
            else {
                pipeline.create(kurentoElement.WEBRTC_ENDPOINT, (error, webRtcEndpoint) => {
                    if(error)
                        callback(error);
                    else
                    {
                        PublishedStream.addListenersToWebRtcEndpoint(webRtcEndpoint, false, iceCandidateCallback);

                        webRtcEndpoint.on('OnIceGatheringDone', (event) => {
                            //console.log(this.className, 'on ice gathering done');

                            if(PublishedStream.isPlayerEndpoint(this.publishWebRtcEndpoint))
                                this.publishWebRtcEndpoint.play();
                        });

                        this.server.addToDownload(1, ()=>{
                            callback(null, webRtcEndpoint);
                        });
                    }
                });
            }
        });
    }


    _getRecordingEndpoint(callback)
    {
        if(this.recordWebrtcEndpoint)
            callback(null, this.recordWebrtcEndpoint);
        else
        {
            let ts = new Date().getTime(); //same stream could be record many times
            let recordID = this.name + '_' + ts;
            let recordURL = this.hasVideo? VIDEO_RECORDING_PATH: AUDIO_RECORDING_PATH;
            let mediaType = this.hasVideo? VIDEO_MEDIA_TYPE: AUDIO_MEDIA_TYPE;

            this.pipeline.create(kurentoElement.RECORDER_ENDPOINT, {uri: recordURL + recordID + '.' + mediaType, mediaProfile : mediaType},(error, recorder) => {
                if (error)
                    return callback(error, null);
                else
                {
                    this.recordWebrtcEndpoint = recorder;
                    this.recordWebrtcEndpoint.wRecordID = recordID; //wRecordID is our custom record ID, incase kurento already have a field called recordID
                    this.server.addToDownload(1, ()=>{
                        callback(null, recorder);
                    });
                }
            });
        }
    }



    _getMediaWebrtcEndpoint(options, callback)
    {
        this._getPipeline((error, pipeline) => {
            if(error)
                callback(error);
            else
            {
                pipeline.create(kurentoElement.PLAYER_ENDPOINT, options, (error, webRtcEndpoint) => {
                    stream.setPublishWebRtcEndpoint(webRtcEndpoint);
                    webRtcEndpoint.play();
                    callback(null, true);

                    //enable to test the recover of nodeJS server crashed while there are kurento stream playing
//                    setTimeout(() => {
//                        //console.log('kurentoWebrtcManager', 'delete published streams');
//                        this.publishedStreams = null;
//                        this.createPublishedStreams();
//                    }, 2000)
                });
            }
        });
    }



    _getPublishWebRtcEndpoint(isSourceFromClient = true, options = {}, iceCandidateCallback, callback)
    {
        if(this.publishWebRtcEndpoint)//have endpoint in memory
            callback(null, this.publishWebRtcEndpoint);
        else
        {
            this.cachedIDs.getItem('publishWebRtcEndpointID', (error, publishWebRtcEndpointID) => {
                if (publishWebRtcEndpointID && !NOCACHE) // has a cached endpoint
                {
                    this.kurentoClient.getMediaobjectById(publishWebRtcEndpointID, (error, publishWebRtcEndpoint) => {
                        if(publishWebRtcEndpoint)
                        {
                            PublishedStream.addListenersToWebRtcEndpoint(publishWebRtcEndpoint, true, iceCandidateCallback);
                            this._setPublishWebRtcEndpoint(publishWebRtcEndpoint);
                        }

                        if(callback)
                            callback(error, publishWebRtcEndpoint);
                    });
                }
                else //create new endpoint
                {
                    this._getPipeline((error, pipeline)=>{
                        if(error)
                        {
                            //console.log(this.className, 'can not get pipeline: ' +  JSON.stringify(error.message));
                            callback(error)
                        }
                        else
                        {
                            const endpointType = isSourceFromClient? 'WebRtcEndpoint' : 'PlayerEndpoint';
                            pipeline.create(endpointType, options, (error, publishWebRtcEndpoint) => {

                                if(error === null)
                                {
                                    PublishedStream.addListenersToWebRtcEndpoint(publishWebRtcEndpoint, true, iceCandidateCallback);
                                    this._setPublishWebRtcEndpoint(publishWebRtcEndpoint);

                                    if(!isSourceFromClient)
                                        publishWebRtcEndpoint.play(); //this line is needed for playing video from server

                                    this.server.addToUpload(1, ()=>{
                                        if(callback)
                                            callback(null, publishWebRtcEndpoint);
                                    })
                                }
                                else
                                {
                                    //console.log(this.className, 'we got a webrtc endpoint creation error: ' +  JSON.stringify(error.message));
                                    if(callback)
                                        callback(error, null);
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    _setPublishWebRtcEndpoint(webRtcEndpoint)
    {
        if(webRtcEndpoint)
        {
            this.publishWebRtcEndpoint = webRtcEndpoint;
            this.cachedIDs.setItem("publishWebRtcEndpointID", webRtcEndpoint.id);
            this._sendQueuedIceCandidates(this.name, webRtcEndpoint);
        }
    }


    _getPipeline(callback)
    {
        if(this.pipeline)//have pipeline in memory
        {
            if(callback)
                callback(null, this.pipeline);
        }
        else
        {
            this.cachedIDs.getItem('pipelineID', (error, pipelineID) => {
                if(pipelineID && !NOCACHE)
                    this.kurentoClient.getMediaobjectById(pipelineID, (error, pipeline) => {
                        if(pipeline)
                            this.pipeline = pipeline;

                        if(callback)
                            callback(error, pipeline);
                    });
                else
                {
                    //new pipeline
                    this.kurentoClient.create(kurentoElement.PIPE_LINE, (error, pipeline) => {
                        if(error === null)
                        {
                            this.pipeline = pipeline;

                            if(callback)
                                callback(null, pipeline);
                        }
                        else
                        {
                            //console.log(this.className, 'we got a pipeline creation error: ' +  JSON.stringify(error.message));
                            if(callback)
                                callback(error, null);
                        }
                    });
                }
            });
        }
    }

    // origin server generate offer for edge
    generateOffer(serverID, onIceCandidateCallback, callback)
    {
        //console.log(PublishedStream.className, this.name + ' generate offer');
        //create viewer endpoint as origin for new server
        this._getViewerWebrtcEndpoint(onIceCandidateCallback, (error, endpoint)=>{
            if(error)
                callback(error);
            else
            {
                //save the endpoint
                this._setPlayWebRtcEndpoint(serverID, endpoint);

                //connect the endpoint to this server publisher
                this._connectPlayerToPublisher(endpoint, (error)=>{
                    if(error)
                        callback(error);
                    else
                    {
                        //create offer to send to edge server
                        endpoint.generateOffer((error, offer)=>{
                            if(!error)
                            {
                                //start gathering candidate
                                endpoint.gatherCandidates(function(error) {
                                    if(error)
                                        console.log(error);
                                });
                            }

                            //send back offer
                            callback(error, offer);
                        });
                    }
                });
            }
        });
    }


    //for accept edge connection request
    processOffer(offer, iceCandidateCallback, callback)
    {
        //console.log(PublishedStream.className, this.name + ' process offer');
        this.startPublishing(offer, iceCandidateCallback, callback);
    }

    //for edge to process answer from origin
    processAnswer(serverID, answer, callback)
    {
        //console.log(PublishedStream.className, this.name + ' process answer');
        this.playWebRtcEndpoints[serverID].processAnswer(answer, (error)=>{
            if(error)
                callback(error);
            else
            {
                this.playWebRtcEndpoints[serverID].gatherCandidates(function(error) {
                });

                callback();
            }
        });
    }


    stopPlaying(userID, callback)
    {
        let endpoint = this.playWebRtcEndpoints[userID];
        if(endpoint)
        {
            endpoint.release();
            endpoint = null;
            avServerManager.releaseServer(this.server.id, 0, 1, callback);
        }
    }


    record(callback)
    {
        if(this.isRecording())
        {
            this._getRecordingEndpoint((error, recorder) =>{
                callback(null, recorder.wRecordID);
            });
        }
        else
        {
            this._getRecordingEndpoint((error, recorder) => {
                if (error)
                    return callback(error, null);
                else
                {
                    this.publishWebRtcEndpoint.connect(recorder, (error) => {
                        if (error)
                            callback(error, null);
                        else
                        {
                            recorder.record((error) => {
                                if (error)
                                    callback(error, null);
                                else
                                {
                                    callback(null, recorder.wRecordID);
                                }
                            });
                        }
                    })
                }
            });
        }
    }

    stopRecord(callback)
    {
        if(this.isRecording())
        {
            this.recordWebrtcEndpoint.stop((error) =>{
                this.recordWebrtcEndpoint= null;
                avServerManager.releaseServer(this.server.id, 0, 1, callback);
            });
        }
        else
            callback(); //not recording, so return immediately
    }
}


PublishedStream.isPlayerEndpoint = function (endpoint) {
    return endpoint.constructor.name === kurentoElement.PLAYER_ENDPOINT;
};


PublishedStream.addListenersToWebRtcEndpoint = function(webRtcEndpoint, ispublishing, iceCandidatesCallback)
{
    //player endpoint class does not need on ice candidate
    const isPlayer = PublishedStream.isPlayerEndpoint(webRtcEndpoint);

    if(!isPlayer)
    {
        webRtcEndpoint.on('OnIceCandidate', (event) => {
            let candidate = kurento.getComplexType('IceCandidate')(event.candidate);
            if(iceCandidatesCallback)
                iceCandidatesCallback(null, candidate);
        });

        webRtcEndpoint.on('MediaStateChanged', (event) => {
            //console.log('on media flow ' + (ispublishing? 'out' : 'in') + ' state change '+event.oldState+' to '+event.newState);
        });
    }
    else
    {
        webRtcEndpoint.on('MediaFlowOutStateChange', function(event){
            //console.log('on media flow out state change');
        });

        webRtcEndpoint.on('MediaFlowInStateChange', function(event){
            //console.log('on media flow in state change');
        });
    }
};


PublishedStream.prototype.buildPublishWebrtcEndpoint = function(callback)
{
    this.cachedIDs.getItem('publishWebRtcEndpointID',  (error, publishWebRtcEndpointID) => {
        if (publishWebRtcEndpointID && !NOCACHE)
            PublishedStream.getMediaByID(publishWebRtcEndpointID, (error, media) => {
                if (media)
                    this.publishWebRtcEndpoint = media;

                if(callback)
                    callback();
            });
        else if(callback)
            callback();
    });
};


PublishedStream.prototype.buildPipeline = function(callback)
{
    this.cachedIDs.getItem('pipelineID', (error, pipelineID) => {
        if(pipelineID && !NOCACHE)
            PublishedStream.getMediaByID(pipelineID, (error, media) => {
                if(media)
                    this.pipeline = media;

                if(callback)
                    callback();
            });
        else if(callback)
            callback();
    });
};



PublishedStream.prototype.build = function(callback)
{
    this.buildPublishWebrtcEndpoint(()  => {
        if(callback)
            callback();
    });
};


PublishedStream.prototype._clearCandidatesQueue = function(userID)
{
    if (this.candidatesQueue[userID]) {
        delete this.candidatesQueue[userID];
    }
};


PublishedStream.prototype.setPipeline = function(pipeline)
{
    if(pipeline)
    {
        this.pipeline = pipeline;
        this.cachedIDs.setItem("pipelineID", pipeline.id);
    }
};


PublishedStream.prototype._setPlayWebRtcEndpoint = function(userID, webRtcEndpoint)
{
    if(webRtcEndpoint)
    {
        this.playWebRtcEndpoints[userID] = webRtcEndpoint;

        this._sendQueuedIceCandidates(userID, webRtcEndpoint);
    }
};


PublishedStream.prototype.onPublishingIceCandidate = function(candidate)
{
    candidate = kurento.getComplexType('IceCandidate')(candidate);

    if (this.publishWebRtcEndpoint) {
        //console.log(this.className,'adding publishing candidate for stream: ' + this.name);
        this.publishWebRtcEndpoint.addIceCandidate(candidate);
    }
    else {
        //console.log(this.className,'Queueing publishing candidate for stream ' + this.name);
        if (!this.candidatesQueue[this.name]) {
            this.candidatesQueue[this.name] = [];
        }
        this.candidatesQueue[this.name].push(candidate);
    }
};


PublishedStream.prototype.onPlayingIceCandidate = function(userID, candidate)
{
    candidate = kurento.getComplexType('IceCandidate')(candidate);

    if (this.playWebRtcEndpoints[userID])
    {
        //console.log(this.className,'adding playing candidate for stream: ' + this.name + '_' + userID);
        this.playWebRtcEndpoints[userID].addIceCandidate(candidate);
    }
    else
    {
        //console.log(this.className,'Queueing playing candidate for stream ' + this.name + '_' + userID);
        if (!this.candidatesQueue[userID]) {
            this.candidatesQueue[userID] = [];
        }
        this.candidatesQueue[userID].push(candidate);
    }
};


PublishedStream.prototype._sendQueuedIceCandidates = function(endPointID, webRtcEndpoint)
{
    if (this.candidatesQueue[endPointID]) {
        //console.log('pubhsed stream', 'sending queued ice candidates for stream ' + this.name);
        while (this.candidatesQueue[endPointID].length) {
            const candidate = this.candidatesQueue[endPointID].shift();
            webRtcEndpoint.addIceCandidate(candidate);
        }
    }
};


PublishedStream.prototype.cleanup = function()
{
    if(this.pipeline)
        this.pipeline.release();

    if(this.server)
    {
        let serverID = this.server.id;
        let downloadCount = Object.keys(this.playWebRtcEndpoints).length + (this.isRecording()? 1 : 0);
        avServerManager.releaseServer(serverID, 1, downloadCount, ()=>{
        });
    }

    this.pipeline = null;
    this.publishWebRtcEndpoint = null;
    this.playWebRtcEndpoints = {};
    this.recordWebrtcEndpoint = null;
    this.candidatesQueue = {};
    this.cachedIDs.remove();
    this.cachedIDs = null;
    this.server = null;
};


PublishedStream.prototype.pause = function()
{
    this.publishWebRtcEndpoint.pause();
};

PublishedStream.prototype.resume = function()
{
    this.publishWebRtcEndpoint.play();
};

PublishedStream.className = "publishedStream";
module.exports = PublishedStream;

