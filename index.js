const ariClient = require('ari-client');
const config = require('config');
const Pino = require('pino');
const log = new Pino({
    name: 'Dana-ARI-Bridge',
});
const Bridge = require('./lib/Bridge');
const mqtt = require('async-mqtt');

let bridges = new Map();

async function main() {
    try {

        const mqttClient = await mqtt.connectAsync(config.get('mqtt.url'))

        const ariConfig = config.get('ari');

        client = await ariClient.connect(ariConfig.url, ariConfig.username, ariConfig.password);

        client.on('StasisStart', async (event, channel) => {

            if (event.args[0] === 'snooping' || event.channel.name.includes('UnicastRTP')) {
                return;
            }

            let logger = log.child({id: channel.id});
            logger.info({event}, 'channel entered our application');

            let bridge;

            //check if we need to make a new bridge for them using the extension dialed
            if (bridges.has(channel.dialplan.exten)) {
                bridge = bridges.get(channel.dialplan.exten)
            } else {
                bridge = new Bridge(client, channel.dialplan.exten, log);
                bridges.set(channel.dialplan.exten, bridge);

                bridge.on('destroyed', () => {
                    bridges.delete(channel.dialplan.exten);
                });

                bridge.on('newStream', async (data) => {
                    await mqttClient.publish(`${config.get('mqtt.topicPrefix')}/newStream`, JSON.stringify({
                        roomName: channel.dialplan.exten,
                        port: data.port
                    }));
                });

                bridge.on('streamEnded', async () => {
                    await mqttClient.publish(`${config.get('mqtt.topicPrefix')}/streamEnded`, JSON.stringify({
                        name: channel.dialplan.exten
                    }));
                });

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