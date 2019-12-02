# Dana TSG ARI Bridge

This application creates a bare bones ARI Confbridge with SFU capabilities. It literally takes calls into an extension and bridges them together using the SFU capabilites inside of Asterisk. The added bit is the ability to snoop on every single participant in a bridge and send their audio to Google's Speech To Text service using Asterisk's new External Media capability from 16.6 onwards

## Requirements

* Node 10+
* Asterisk 16.6 onwards (but not 17 yet oddly)
* [Dana-TSG-RTP-STT-AudioServer](https://github.com/nimbleape/dana-tsg-rtp-stt-audioserver) running elsewhere
* MQTT Server

## Install

```
yarn
```

## Run

Set your config settings in `config/default.js` (or `config/production.js` if you're running with `NODE_ENV=production`)

```
yarn start
```

## Logging

This project uses Pino as it's logging library which outputs JSON to the console. You can make this easier ot read using `pino-pretty` or just use the `yarn start-pretty` command.

## Dockerfile

The included Dockerfile is very opinionated. It uses multi stage builds and then uses a "distroless" Node.js image from Google. there's no point exec'ing into it because there's no bash terminal available etc. Use it as Docker should be used :)
