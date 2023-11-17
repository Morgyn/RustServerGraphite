import valveserverquery from '@fabricio-191/valve-server-query';
const { Server, RCON } = valveserverquery;

import util from 'util';
const { promisify } = util;
import dns from 'dns';
import net from 'net';

const delay = 150000;
const debug = true;

var graphiteHost = null;
var graphitePort = null;


async function validateFeedsString(feedsString)  {
    try {
        const feedsArray = feedsString.split(',');
        const feedsData = [];

        for (const feed of feedsArray) {
            const [name, host, port] = feed.split(':');

            if (!name || !host || !port) {
                console.error(`Error in feed: '${feed}' format: 'name:host:port'.`);
                return false;
            }

            if (isNaN(port)) {
                console.error(`Error in feed: '${feed}' format: 'name:host:port'. Port is invalid`);
                return false;
            }

            if (!(await isValidHost(host))) {
                console.error(`Error in feed: '${feed}' format: 'name:host:port'. Host is invalid`);
                return false;
            }
            feedsData.push({
                name,
                host,
                port: parseInt(port),
            });
        }
        return feedsData;
    } catch (error) {
        console.error(error);
        return false;
    }
};

async function validateDestination(graphiteDestination) {
    try {
        const [host, port] = graphiteDestination.split(':');

        if (!host || !port) {
            console.error(`Error in DEST: '${graphiteDestination}' format: 'host:port'.`);
            return false;
        }

        if (isNaN(port)) {
            console.error(`Error in DEST: '${graphiteDestination}' format: 'host:port'. Port is invalid.`);
            return false;
        }

        if (!(await isValidHost(host))) {
            console.error(`Error in DEST: '${graphiteDestination}' format: 'host:port'.  Host is invalid`);
            return false;
        }

        graphiteHost = host;
        graphitePort = port;
    
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function isValidHost(host)  {
    if (isValidIpAddress(host)) {
        return true;
    }

    return await promisify(dns.lookup)(host)
        .then(() => true)
        .catch(() => false);
};

function isValidIpAddress (ip) {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
};

async function checkFeeds() {
    if (!feedsString) {
        console.error('FEEDS environment variable is not set.');
        return false;
    } 

    // Validate the FEEDS string and get the array of objects
    feedsData = await validateFeedsString(feedsString);
    if (feedsData == false) {
        console.error('FEEDS string is not in the correct format or contains invalid parameters.');
        return false;
    }
    console.log('Feeds data:', feedsData);
    return true;
} 

async function checkDest() {
    if (!graphiteDestination) {
        console.error('DEST environment variable is not set.');
        return false;
    } 

    // Validate the FEEDS string and get the array of objects
    if (await validateDestination(graphiteDestination)) {
        return true;
    }
    console.error('DEST string is not in the correct format or contains invalid parameters.');
    return false;
} 

function pollServers() {
    feedsData.forEach( async obj =>  {
        const server = await Server({
            ip: obj.host,
            port: obj.port,
            timeout: 3000,
          });
      
        const info = await server.getInfo();

        var client = new net.Socket();

        client.connect(graphitePort, graphiteHost, function() {
            const updateString = `${obj.name} ${info.players.online} ${Math.floor(Date.now() / 1000)}`;
            if (debug) console.log(updateString);
            client.write(updateString+"\n");
            client.destroy();
        });
    })
}

process.on('SIGINT', () => {
    console.log('SIGINT, closing...');
    if (intervalId) clearInterval(intervalId);
    process.exit();
});

var feedsData = {};
var intervalId = null;
const feedsString = process.env.FEEDS;
const graphiteDestination = process.env.DEST;

if (await checkDest() && await checkFeeds()) {
    intervalId = setInterval(pollServers, delay);
    process.stdin.resume();
};