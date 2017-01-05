const debug = require('debug')('loopback-component-migrate');
const migrationDef = require('./models/migration.json');
const migrationMapDef = require('./models/migration-map.json');
const MigrationInstance = require('./models/migration');
const MigrationMapInstance = require('./models/migration-map');

// Remove proerties that will confuse LB
function getSettings(def) {
  const settings = {};
  Object.keys(def)
    .filter(i => i === 'name')
    .filter(i => i === 'properties')
    .forEach((i) => {
      settings[i] = def[i];
    });
  return settings;
}

/**
 * @param {Object} app The app instance
 * @param {Object} options The options object
 */
module.exports = (app, opt) => {
  const options = opt || {};

  let dataSource = options.dataSource || 'db';
  if (typeof dataSource === 'string') {
    dataSource = app.dataSources[dataSource];
  }

  const migrationModelSettings = getSettings(migrationDef);
  const migrationMapModelSettings = getSettings(migrationMapDef);

  if (typeof options.acls !== 'object') {
    migrationModelSettings.acls = migrationMapModelSettings.acls = [];
  } else {
    migrationModelSettings.acls = migrationMapModelSettings.acls = options.acls;
  }

  debug('Creating Migration model using settings: %o', migrationModelSettings);
  const MigrationModel = dataSource.createModel(
    migrationDef.name,
    migrationDef.properties,
    migrationModelSettings);

  debug('Creating MigrationMap model using settings: %o', migrationModelSettings);
  const MigrationMapModel = dataSource.createModel(
    migrationMapDef.name,
    migrationMapDef.properties,
    migrationMapModelSettings);

  const Migration = MigrationInstance(MigrationModel, options);
  const MigrationMap = MigrationMapInstance(MigrationMapModel, options);
  const exposed = options.public || false;
  app.model(Migration, {
    public: exposed,
  });
  app.model(MigrationMap, {
    public: exposed,
  });

  if (!options.enableRest) {
    Migration.disableRemoteMethodByName('migrateTo');
    Migration.disableRemoteMethodByName('rollbackTo');
  }
};
