const env = process.env.NODE_ENV || 'development';

const config =
  env === 'production'
    ? require('./prod.dbconfig')
    : require('./dev.dbconfig');

module.exports = config;
