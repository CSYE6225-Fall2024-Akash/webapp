const SDC = require('statsd-client');

const sdc = new SDC({
    host: 'localhost',
    port: 8125,
    prefix: 'webapp.'
});

const metrics = {
    // API call counter
    incrementApiCall: (path) => {
        sdc.increment(`api.${path}.calls`);
    },

    // API response time
    apiTimer: (path) => {
        const startTime = Date.now();
        return {
            end: () => {
                const duration = Date.now() - startTime;
                sdc.timing(`api.${path}.response_time`, duration);
                return duration;
            }
        };
    },

    // Database query timer
    dbTimer: (operation) => {
        const startTime = Date.now();
        return {
            end: () => {
                const duration = Date.now() - startTime;
                sdc.timing(`db.${operation}.query_time`, duration);
                return duration;
            }
        };
    },

    // S3 operation timer
    s3Timer: (operation) => {
        const startTime = Date.now();
        return {
            end: () => {
                const duration = Date.now() - startTime;
                sdc.timing(`s3.${operation}.response_time`, duration);
                return duration;
            }
        };
    }
};

module.exports = metrics;