/* eslint-disable global-require, import/no-dynamic-require */
const debug = require('debug')('loopback-component-migrate');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const utils = require('loopback/lib/utils');

module.exports = (Mig, opt) => {
  const options = opt || {};
  const Migration = Mig;
  Migration.log = options.log || console;
  Migration.log = typeof Migration.log === 'string' ? require(Migration.log) : Migration.log;
  Migration.migrationsDir = options.migrationsDir || path.join(process.cwd(), 'server', 'migrations');
  debug('Migrations directory set to: %s', Migration.migrationsDir);

  /**
   * Remote Method: Run pending migrations.
   *
   * @param {String} [to] Name of the migration script to migrate to.
   * @param {Function} [cb] Callback function.
   */
  Migration.migrateTo = (to = '', cb = utils.createPromiseCallback()) => {
    assert(typeof to === 'string', `The to argument must be a string, not ${typeof to}`);
    assert(typeof cb === 'function', `The cb argument must be a function, not ${typeof cb}`);
    Migration.migrate('up', to, cb);
    return cb.promise;
  };

  /**
   * Remote Method: Rollback migrations.
   *
   * @param {String} [to] Name of migration script to rollback to.
   * @param {Function} [cb] Callback function.
   */
  Migration.rollbackTo = (to = '', cb = utils.createPromiseCallback()) => {
    assert(typeof to === 'string', `The to argument must be a string, not ${typeof to}`);
    assert(typeof cb === 'function', `The cb argument must be a function, not ${typeof cb}`);
    Migration.migrate('down', to, cb);
    return cb.promise;
  };

  /**
   * Run migrations (up or down).
   *
   * @param {String} [upOrDown] Direction (up or down)
   * @param {String} [to] Name of migration script to migrate/rollback to.
   * @param {Function} [cb] Callback function.
   */
  Migration.migrate = (upOrDown = 'up', to = '', cb = utils.createPromiseCallback()) => {
    assert(typeof upOrDown === 'string', `The upOrDown argument must be a string, not ${typeof upOrDown}`);
    assert(typeof to === 'string', `The to argument must be a string, not ${typeof to}`);
    assert(typeof cb === 'function', `The cb argument must be a function, not ${typeof cb}`);

    if (Migration.app.migrating) {
      Migration.log.warn('Unable to start migrations: already running');
      process.nextTick(() => {
        cb();
      });
      return cb.promise;
    }

    Migration.hrstart = process.hrtime();
    Migration.app.migrating = true;

    Migration.findScriptsToRun(upOrDown, to, (err, scriptsToRun = []) => {
      const migrationCallStack = [];
      let migrationCallIndex = 0;

      if (scriptsToRun.length) {
        Migration.log.info(`
Running migrations:
${scriptsToRun}
`);
      }

      scriptsToRun.forEach((localScriptName) => {
        migrationCallStack.push(() => {
          let migrationStartTime;

          // keep calling scripts recursively until we are done, then exit
          function runNextScript(error) {
            if (error) {
              Migration.log.error('Error saving migration', localScriptName, 'to database!');
              Migration.log.error(error);
              Migration.finish(error);
              return cb(error);
            }
            const migrationEndTime = process.hrtime(migrationStartTime);
            Migration.log.info('%s finished sucessfully. Migration time was %ds %dms',
              localScriptName, migrationEndTime[0], migrationEndTime[1] / 1000000);
            migrationCallIndex += 1;
            if (migrationCallIndex < migrationCallStack.length) {
              migrationCallStack[migrationCallIndex]();
            } else {
              Migration.finish();
            }
            return cb();
          }

          try {
            // include the script, run the up/down function,
            // update the migrations table, and continue.
            migrationStartTime = process.hrtime();
            Migration.log.info(localScriptName, 'running.');
            const scriptPath = path.resolve(path.join(Migration.migrationsDir, localScriptName));
            /* eslint-disable global-rquest, import/no-dynamic-require */
            require(scriptPath)[upOrDown](Migration.app, (error) => {
              if (error) {
                Migration.log.error(localScriptName, 'error:');
                Migration.log.error(error.stack);
                Migration.finish(error);
                cb(error);
              } else if (upOrDown === 'up') {
                Migration.create({
                  name: localScriptName,
                  runDtTm: new Date(),
                }, runNextScript);
              } else {
                Migration.destroyAll({
                  name: localScriptName,
                }, runNextScript);
              }
            });
          } catch (error) {
            Migration.log.error('Error running migration', localScriptName);
            Migration.log.error(error.stack);
            Migration.finish(error);
            cb(error);
          }
        });
      });

      // kick off recursive calls
      if (migrationCallStack.length) {
        migrationCallStack[migrationCallIndex]();
      } else {
        delete Migration.app.migrating;
        Migration.emit('complete');
        Migration.log.info('No new migrations to run.');
      }
    });

    return cb.promise;
  };

  Migration.finish = (err) => {
    if (err) {
      Migration.log.error('Migrations did not complete. An error was encountered:', err);
      Migration.emit('error', err);
    } else {
      Migration.log.info('All migrations have run without any errors.');
      Migration.emit('complete');
    }
    delete Migration.app.migrating;
    const hrend = process.hrtime(Migration.hrstart);
    Migration.log.info('Total migration time was %ds %dms', hrend[0], hrend[1] / 1000000);
  };

  Migration.findScriptsToRun = (upOrDown = 'up', t = '', cb = utils.createPromiseCallback()) => {
    let to = t;
    debug('findScriptsToRun direction:%s, to:%s', upOrDown, to);
    // Add .js to the script name if it wasn't provided.
    if (to && to.substring(to.length - 3, to.length) !== '.js') {
      to += '.js';
    }
    let scriptsToRun = [];
    const order = upOrDown === 'down' ? 'name DESC' : 'name ASC';
    const filters = {
      order,
    };

    if (to) {
      // DOWN: find only those that are greater than the 'to' point in descending order.
      // UP: find only those that are less than the 'to' point in ascending order.
      if (upOrDown === 'down') {
        filters.where = {
          name: {
            gte: to,
          },
        };
      } else {
        filters.where = {
          name: {
            lte: to,
          },
        };
      }
    }
    debug('fetching migrations from db using filter %j', filters);
    Migration.find(filters)
      .then((fun) => {
        const scriptsAlreadyRan = fun.map(Migration.mapScriptObjName);
        debug('scriptsAlreadyRan: %j', scriptsAlreadyRan);
        // Find rollback scripts.
        if (upOrDown === 'down') {
          // If the requested rollback script has not already run,
          // return just the requested one if it is a valid script.
          // This facilitates rollback of failed migrations.
          if (to && scriptsAlreadyRan.indexOf(to) === -1) {
            debug('requested script has not already run - returning single script as standalone rollback script');
            scriptsToRun = [to];
            cb(null, scriptsToRun);
          } else {
            // Remove the last item since we don't want to roll back the requested script.
            // Find migration scripts.
            if (scriptsAlreadyRan.length && to) {
              scriptsAlreadyRan.pop();
              debug('remove last item. scriptsAlreadyRan: %j', scriptsAlreadyRan);
            }
            scriptsToRun = scriptsAlreadyRan;

            debug('Found scripts to run: %j', scriptsToRun);
            cb(null, scriptsToRun);
          }
        } else {
          // get all local scripts and filter for only .js files
          let candidateScripts = fs
              .readdirSync(Migration.migrationsDir)
              .filter(fileName => fileName.substring(fileName.length - 3, fileName.length) === '.js');
          debug('Found %s candidate scripts: %j', candidateScripts.length, candidateScripts);

          // filter out those that come after the requested to value.
          if (to) {
            candidateScripts = candidateScripts.filter((fileName) => {
              const inRange = fileName <= to;
              debug('checking wether %s is in range (%s <= %s): %s', fileName, fileName, to, inRange);
              return inRange;
            });
          }

          // filter out those that have already ran
          candidateScripts = candidateScripts.filter((fileName) => {
            debug('checking wether %s has already run', fileName);
            const alreadyRan = scriptsAlreadyRan.indexOf(fileName) !== -1;
            debug('checking wether %s has already run: %s', fileName, alreadyRan);
            return !alreadyRan;
          });

          scriptsToRun = candidateScripts;
          debug('Found scripts to run: %j', scriptsToRun);
          cb(null, scriptsToRun);
        }
      })
      .catch((err) => {
        Migration.log.error('Error retrieving migrations:');
        Migration.log.error(err.stack);
        cb(err);
      });

    return cb.promise;
  };

  Migration.mapScriptObjName = scriptObj => scriptObj.name;

  return Migration;
};
