const loopback = require('loopback');
const boot = require('loopback-boot');
const explorer = require('loopback-component-explorer');
const path = require('path');

const app = module.exports = loopback();

/* eslint-disable no-console, global-require, import/no-dynamic-require */
app.use('/api', loopback.rest());

// start the web server
app.start = () => app.listen(() => {
  app.emit('started');
  console.log('Web server listening at: %s', app.get('url'));
  console.log('Explorer mounted at : %s', `${app.get('url')} explorer`);
});

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, (err) => {
  if (err) throw err;

  const migrate = require(path.join(__dirname, '..', '..', '..', '..', 'lib'));
  const options = {
    // dataSource: ds, // Data source for migrate data persistence,
    migrationsDir: path.join(__dirname, 'migrations'), // Migrations directory.
    enableRest: true,
  };
  migrate(app, options);

  // Register explorer using component-centric API:
  explorer(app, { basePath: '/api', mountPath: '/explorer' });

  // start the server if `$ node server.js`
  if (require.main === module) {
    app.start();
  }
});
