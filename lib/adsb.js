'use strict';

const net = require('net');
const EventEmitter = require('events');
const Demodulator = require('mode-s-demodulator');
const AircraftStore = require('mode-s-aircraft-store');

const noop = function () {};

class Adsb extends EventEmitter {

    constructor() {
        super();
        this.demodulator = new Demodulator();
        this.store = new AircraftStore({
            timeout: 30000
        });
    }

    start(argv) {
        if (this.instance) {
            throw new Error('Cannot start ADS-B client more than once');
        }
        this._initSocket(argv);
        /*
        this.mode = argv.mode || 'rtlsdr';

        switch (this.mode) {
            case 'network':
                // Connect to network stream
                this._initSocket(argv);
                break;
            case 'rtlsdr':
                // Connect to RTLSDR device
                this._initDevice(argv);
                break;
            default:
                throw new Error(`Mode "${this.mode}" not supported`);
        } */
    }

    stop() {
        this.instance.destroy();
        /*
        switch (this.mode) {
            case 'network':
                this.instance.destroy();
                break;
            case 'rtlsdr':
            default:
                rtlsdr.cancel_async(this.instance);
                rtlsdr.close(this.instance);
        } */
    }

    getStore() {
        return this.store;
    }

    _initSocket(argv, attempts = 0) {
        if (!argv.host) {
            throw new Error('The host (IP or hostname) is required in "network" mode. Please specify one.');
        }
        if (!argv.port) {
            throw new Error('The port is required in "network" mode. Please specify one.');
        }

        this.instance = new net.Socket()
            .on('data', data => {
                data.toString().split("\n").forEach(line => {
                    const csv = line.trim().split(',');

                    if (['ID', 'AIR', 'MSG'].includes(csv[0])) {
                        this.store.addMessage(csv);
                    }
                });
            }).on('close', () => {
                this.emit('socket-closed');
                const timeout = Math.min(Math.pow(attempts, 2), 30);
                console.warn(`Stream to ${argv.host}:${argv.port} has been closed due to an error. Retrying to open it again in ${timeout} seconds ...`);
                attempts++;
                setTimeout(() => {
                    this._initSocket(argv, attempts);
                }, timeout * 1000);
            }).on('error', error => {
                console.error(`Failed to open stream to ${argv.host}:${argv.port}: ${error.message}`);
            }).connect(argv.port, argv.host, () => {
                console.log(`Successfully opened stream to ${argv.host}:${argv.port}. Waiting for data...`);
                this.emit('socket-opened');
            });
    }

}

module.exports = Adsb;
