const ariClient = require('ari-client');
const config = require('config');
const Pino = require('pino');
const log = new Pino({
    name: 'Dana-ARI-Bridge',
});
const Bridge = require('./lib/Bridge');
const mqtt = require('async-mqtt');

let bridges = new Map();

log.info('Starting');

async function main() {
    try {
        let mqttClient = null;

        if (config.get('mqtt.url')) {
            log.info('trying to connect to mqtt');
            mqttClient = await mqtt.connectAsync(config.get('mqtt.url'))
            log.info('connected to mqtt');
        }

        const ariConfig = config.get('ari');

        log.info({ ariConfig }, 'ari config');

        client = await ariClient.connect(ariConfig.url, ariConfig.username, ariConfig.password);
        log.info('connected to ari websocket');

        client.on('StasisStart', async (event, channel) => {

            if (event.args[0] === 'snooping' || event.channel.name.includes('UnicastRTP')) {
                return;
            }

            let logger = log.child({id: channel.id});
            logger.info({event}, 'channel entered our application');

            let bridge;
            let bridgeName = channel.dialplan.exten;

            //check if we need to make a new bridge for them using the extension dialed
            if (bridges.has(bridgeName)) {
                bridge = bridges.get(bridgeName)
            } else {
                bridge = new Bridge(client, bridgeName, log);
                bridges.set(bridgeName, bridge);

                bridge.on('empty', async () => {
                    await bridge.destroy();
                    bridges.delete(bridgeName);
                });

                if (mqttClient) {
                    bridge.on('newStream', async (data) => {
                        await mqttClient.publish(`${config.get('mqtt.topicPrefix')}/newStream`, JSON.stringify({
                            roomName: data.roomName,
                            port: data.port,
                            callerName: data.callerName,
                            channelId: data.channelId
                        }));

                    });

                    bridge.on('streamEnded', async (data) => {
                        await mqttClient.publish(`${config.get('mqtt.topicPrefix')}/streamEnded`, JSON.stringify({
                            name: data.roomName,
                            port: data.port,
                            callerName: data.callerName,
                            channelId: data.channelId
                        }));
                    });
                }

                await bridge.create();
            }

            let currentPlayback = client.Playback();

            await channel.answer();

            currentPlayback.on('PlaybackFinished', () => {
                bridge.addChannel(channel);
            });

            await channel.play({media: 'sound:beep'}, currentPlayback);
        });

        client.on('StasisEnd', (event, channel) => {

        });

        await client.start(ariConfig.appName);
        log.info('ari started');
    } catch (err) {
        throw err;
    }
};

main();