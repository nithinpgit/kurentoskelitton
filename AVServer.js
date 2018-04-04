/**
 * Created by Isaac on 5/15/17.
 */
const kurento = require('kurento-client');

class AVServer {
    constructor(sessionID, id) {
        this.sessionID = sessionID;
        this.id = id;
        this.ip = '';
        this.capacity = 0;
        this.zone = 0;

        this.totalUpload = 0; //read from DB;
        this.totalDownload = 0; //read from DB

        this.kurentoClient = null;
    }

    getClient(callback) {
        if (this.kurentoClient)
            callback(null, this.kurentoClient);
        else {
            if (this.ip.length) {
                kurento(this.ip, (error, kurentoClient) => {
                    if (error === null) {
                        this.kurentoClient = kurentoClient;
                        kurentoClient.on('connect', () => {
                            //console.log('connect');
                        });

                        kurentoClient.on('disconnect', () => {
                            //console.log('disconnect');
                            this.cleanup();
                        });

                        kurentoClient.on('connect_error', () => {
                            //console.log('connect_error');
                        });

                        kurentoClient.on('error', () => {
                            //console.log('error');
                        });

                        callback(null, kurentoClient);
                    }
                    else {
                        //console.log(this.className, 'we got a kurento Client error: ' + JSON.stringify(error.message));
                        callback(error, null);
                    }
                })
            }
            else
                callback('no ip for server', null);
        }
    }


    setProperties(info) {
        this.id = info.id || this.id;
        this.ip = info.ip || this.ip;
        this.capacity = info.capacity || this.capacity;
        this.zone = info.zone || this.zone;
        this.totalDownload = info.totalDownload || this.totalDownload;
        this.totalUpload = info.totalUpload || this.totalUpload;
    }

    addToUpload(count = 1, callback) {
        callback();
    }

    removeFromUpload(count = 1, callback) {
        callback();
    }


    addToDownload(count = 1, callback) {
        callback();
    }

    removeFromDownload(count = 1, callback) {
        callback();
    }

    save(callback) {
        callback();
    }
}


AVServer.moduleName = 'avServer';
module.exports = AVServer;