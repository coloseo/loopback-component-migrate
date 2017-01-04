#! /usr/bin/env node
/* eslint-disable no-console, global-require, import/no-dynamic-require */
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const debug = require('debug')('loopback-component-migrate');
const program = require('commander');

const version = require(`${process.cwd()}/package.json`).version;

/**
 * Command line implementation for migrate.
 *
 * Common usage case is:
 *
 * ./node_modules/.bin/migrate create|up|down
 */
program
  .version(version)
  .option('-d, --migrations-dir <path>', 'set migrations directory. defaults to ./server/migrations')
  .option('-s, --server <path>', 'set server path. defaults to ./server/server.js');

program
  .command('create [name]')
  .description('create a new migration script')
  .action((name) => {
    function stringifyAndPadLeading(num) {
      const str = `${num}`;
      return (str.length === 1) ? `0${str}` : str;
    }

    function generateFileName(n) {
      const d = new Date();
      const year = `${d.getFullYear()}`;
      const month = stringifyAndPadLeading(d.getMonth() + 1);
      const day = stringifyAndPadLeading(d.getDate());
      const hours = stringifyAndPadLeading(d.getHours());
      const minutes = stringifyAndPadLeading(d.getMinutes());
      const seconds = stringifyAndPadLeading(d.getSeconds());
      const dateString = year + month + day + hours + minutes + seconds;
      const middleName = n ? `-${n}` : '';
      const fileName = `${dateString}${middleName}.js`;
      return fileName;
    }

    function getMigrationsDir() {
      const dir = path.join(process.cwd(), 'server', 'migrations');
      debug('Using migrations directory: %s', dir);
      return dir;
    }

    function ensureDirectory(dir) {
      debug('Preparing migrations directory: %s', dir);
      mkdirp.sync(dir);
    }

    function writeFile(fileName, contents) {
      debug('Creating migration script: %s', fileName);
      const migrationsDir = getMigrationsDir();
      ensureDirectory(migrationsDir);
      const filePath = path.join(migrationsDir, fileName);
      fs.writeFileSync(filePath, contents);
    }

    // Create the migration file.
    const fileName = generateFileName(name);
    const migrationsDir = path.join(process.cwd(), 'server', 'migrations');
    console.log('Creating migration script %s in %s', fileName, migrationsDir);

    const fileContent = fs.readFileSync(path.join(__dirname, '..', 'migration-skeleton.js'));
    writeFile(fileName, fileContent);
  });

program
  .command('migrate <to>')
  .alias('up')
  .description('Migrate to the given migration')
  .action((to) => {
    console.log('Migrating up to: "%s" [TODO]', to);
    const server = program.server || `${process.cwd()}/server/server.js`;
    require(path.resolve(process.cwd(), server));
  })
  .on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ migrate 005');
    console.log('    $ up 005');
    console.log();
  });

program
  .command('rollback <to>')
  .alias('down')
  .description('Rollback to the given migration')
  .action((to) => {
    console.log('Rolling back to: "%s" [TODO]', to);
    const server = program.server || `${process.cwd()}/server/server.js`;
    require(path.resolve(process.cwd(), server));
  })
  .on('--help', () => {
    console.log('  Examples:');
    console.log();
    console.log('    $ rollback 001');
    console.log('    $ down 001');
    console.log();
  });

program.parse(process.argv);
