const config = require('config');
const { EventEmitter } = require('events');

class Bridge extends EventEmitter {
    constructor(ariClient, exten, log) {
        super();
        this.logger = log.child({bridgeName: exten});
        this.ariClient = ariClient;
    }

    async create () {
        this.bridge = await this.ariClient.Bridge();
        await this.bridge.create({type: 'video_sfu,mixing'});

        this.bridge.on('ChannelLeftBridge', (event) => {
            this.logger.info(event, 'Channel left bridge');
            if (event.bridge.channels.length === 0) {
                this.bridge.destroy();
                this.emit('destroyed');
            }
        })

        return this.bridge;
    }

    async addChannel(channel) {
        await this.bridge.addChannel({channel: channel.id});

        //create the bridge that'll link the snooping channel & externalMedia channels
        let bridge = await this.ariClient.Bridge();
        let externalMediaChannel = this.ariClient.Channel();

        let bridgeRes = await bridge.create({type: 'mixing', name: `${channel.id}-snooping-bridge`});
        this.logger.info('created a bridge for the snoop & externalMedia');

        let snoopOptions = {
            app: config.get('ari.appName'),
            appArgs: 'snooping',
            channelId: channel.id,
            snoopId: channel.id + '_snoop',
            spy: 'in'
        };

        //create the external Media channel
        let snoopChannelRes = await this.ariClient.channels.snoopChannelWithId(snoopOptions);
        this.logger.info('created a snooping channel');


        bridge.addChannel({channel: snoopChannelRes.id});
        snoopChannelRes.on('StasisEnd', () => {
            this.logger.info('snoop channel ended');
            externalMediaChannel.hangup();
        })


        externalMediaChannel.on('StasisStart', (event, channel) => {
            this.logger.info(event, 'got a stasisStart event on the externalMediaChannel');
            bridge.addChannel({channel: channel.id});
        });

        externalMediaChannel.on('StasisEnd', () => {
            this.logger.info('external media channel ended');
            bridge.destroy();
            this.emit('streamEnded');
        });

        let externalMediaOptions = {
            app: config.get('ari.appName'),
            external_host: `${config.get('rtpServer.host')}:${config.get('rtpServer.port')}`,
            format: config.get('rtpServer.format')
        };

        let externalMediaRes = await externalMediaChannel.externalMedia(externalMediaOptions);

        //set the externalMediaSourcePort
        let externalMediaUdpSourcePort = externalMediaRes.local_port;

        this.emit('newStream', {
            port: externalMediaUdpSourcePort
        });

        this.logger.info('created an externalMedia channel');
    }
}

module.exports = Bridge;  // i miss exports default