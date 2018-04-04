/**
 * Created by Isaac on 5/15/17.
 */


const AVServer = require('./AVServer');

class AVServerManager {
    constructor() {
        this.servers = {};

        this.selectedOriginServerID = null;
    }


    getOrigin(zone, callback) {

        if (this.selectedOriginServerID) {
            if (this.servers[this.selectedOriginServerID])
                this._returnServer(this.servers[this.selectedOriginServerID], callback);
            else
                this._loadFromDB((error) => {
                    if (error)
                        callback(error);
                    else if (this.servers[this.selectedOriginServerID])
                        this._returnServer(this.servers[this.selectedOriginServerID], callback);
                    else
                        this._selectOrigin(zone, callback);
                })
        }
        else
            this._selectOrigin(zone, callback);
    }

    _returnServer(server, callback) {
        //get client is just to load client into server
        server.getClient((error, client) => {
            if (error)
                callback(error);
            else
                callback(null, server);
        });
    }

    _loadFromDB(callback) {
        if(Object.keys(this.servers).length === 0)
        {
            let serverOne = new AVServer(2, 1);
           //serverOne.ip = 'ws://janus.omnovia-test.com:8888/kurento';
           serverOne.ip = 'ws://devmedia.flowapp.com:8888/kurento'
           //serverOne.ip = 'ws://jitsi.omnovia.com:8888/kurento';
            //serverOne.ip = 'ws://ec2-54-153-112-203.us-west-1.compute.amazonaws.com:8888/kurento';
            this.servers[1] = serverOne;

            let serverTwo = new AVServer(2, 2);
         //serverTwo.ip = 'ws://ec2-54-153-112-203.us-west-1.compute.amazonaws.com:8888/kurento';
            //serverTwo.ip = 'ws://janus.omnovia-test.com:8888/kurento';
            serverTwo.ip = 'ws://devmedia.flowapp.com:5555/kurento'
            //serverTwo.ip = 'ws://jitsi.omnovia.com:8888/kurento';
            this.servers[2] = serverTwo;
        }

        callback();
    }


    _saveAllServers(callback) {
        callback();
    }


    _selectOrigin(zone, callback) {
        this._loadFromDB((error) => {
            let selectedServer = this.servers[1];
            this.selectedOriginServerID = selectedServer.id;
            this._returnServer(selectedServer, callback);
        });
    }


    getEdge(zone, callback) {
        this._loadFromDB((error) => {
            let selectedServer = this.servers[2]; //use 1 to test different server

            this._returnServer(selectedServer, callback);
        });
    }

    releaseServer(serverID, uploadCount, downloadCount, callback) {
        callback();
    }

    releaseEdge(serverID, load, callback) {
        callback();
    }

    releaseOrigin(callback) {
        callback();
    }
}

AVServerManager.moduleName = 'avServerManager';

module.exports = AVServerManager;