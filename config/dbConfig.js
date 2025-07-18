const env = process.env.NODE_ENV || 'development';

const config =
  env === 'production'
    ? require('./prod.dbConfig')
    : require('./dev.dbConfig');

module.exports = config;
