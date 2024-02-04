const Queue = require('bull');
const path = require('path');

// Get the current directory path
const currentPath = __dirname;

// Get the parent directory path
const parentPath = path.dirname(currentPath);
const redisUrl = 'redis://127.0.0.1:6379'
global.appRoot = parentPath;
global._pathconst = require('../api/helpers/constantdata/pathconst')

const uploadEmailProcessor = require('./processors/uploadEmail');

const uploadEmailQueue = new Queue('Email Queue', redisUrl);

uploadEmailQueue.process((job) => runWatchProcessor(job));

// if you want to schedule a cron job //
// uploadEmailQueue.add(null, { repeat: { cron: "0 0 * * *" } });

// if you want to use as exported module //
// const { uploadEmailQueue } = require("..");
// uploadEmailQueue.add({data: "tushar"})

module.exports = {
    uploadEmailQueue,
};


