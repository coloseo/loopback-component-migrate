A library to add simple database migration support to loopback projects. support loopback v3.x

[![Build Status](https://api.travis-ci.org/coloseo/loopback-component-migration.svg?branch=master)](https://travis-ci.org/coloseo/loopback-component-migration)

Migrations that have been run will be stored in a table called 'Migrations'.
The library will read the loopback datasources.json files based on the NODE_ENV environment variable just like loopback does.
The usage is based on the node-db-migrate project.

## Installation

1. Install in you loopback project:

  `npm install --save loopback-component-migration`

2. Create a component-config.json file in your server folder (if you don't already have one)

3. Enable the component inside `component-config.json`.

  ```json
  {
    "loopback-component-migration": {
      "key": "value"
    }
  }
  ```

**Options:**

- `log`

  [String] : Name of the logging class to use for log messages. *(default: 'console')*

- `enableRest`

  [Boolean] : A boolean indicating wether migrate/rollback REST api methods should be exposed on the Migration model. *(default: false)*

- `migrationsDir`

  [String] : Directory containing migration scripts. *(default: server/migrations)*

- `dataSource`

  [String] : Datasource to connect the Migration and MigrationMap models to. *(default: db)*

- `acls`

  [Array] : ACLs to apply to Migration and MigrationMap models. *(default: [])*

- `public`

    [Boolean] : A boolean indicating wether REST api methods should be exposed on the Migration and MigrationMap models. *(default: false)*


## Running Migrations

Migrations can be run by calling the static `migrate` method on the Migration model. If you do not specify a callback, a promise will be returned.

**Run all pending migrations:**
```javascript
Migrate.migrate('up', '', function(err) {});
```

**Run all pending migrations upto and including 0002-somechanges:**
```javascript
Migrate.migrate('up', '0002-somechanges', function(err) {});
```

**Rollback all migrations:**
```javascript
Migrate.migrate('down', '', function(err) {}); //*the second param can not be missed
```

**Rollback migrations upto and including 0002-somechanges:**
```javascript
Migrate.migrate('down', '0002-somechanges', function(err) {});
```

## Example migrations
```javascript
module.exports = {
  up: function(app, next) {
    app.models.Users.create({ ... }, next);
  },
  down: function(app, next) {
    app.models.Users.destroyAll({ ... }, next);
  }
};
```

```javascript
/* executing raw sql */
module.exports = {
  up: function(app, next) {
    app.dataSources.mysql.connector.query('CREATE TABLE `my_table` ...;', next);
  },
  down: function(app, next) {
   app.dataSources.mysql.connector.query('DROP TABLE `my_table`;', next);
  }
};
```
