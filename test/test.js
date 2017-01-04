const _ = require('lodash');
const lt = require('loopback-testify');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const app = require('./fixtures/simple-app/server/server');
const m1 = require('./fixtures/simple-app/server/migrations/0001-initialize');
const m2 = require('./fixtures/simple-app/server/migrations/0002-somechanges');
const m3 = require('./fixtures/simple-app/server/migrations/0003-morechanges');
global.Promise = require('bluebird');

const expect = chai.expect;
chai.use(sinonChai);
/* eslint-disable no-unused-expressions */
lt.beforeEach.withApp(app);

describe('loopback db migrate', () => {
  describe('initialization', () => {
    it('should attach a Migration model to the app', () => {
      expect(app.models.Migration).to.exist;
      expect(app.models.Migration).itself.to.respondTo('migrate');
    });
    it('should attach a MigrationMap model to the app', () => {
      expect(app.models.Migration).to.exist;
    });
    it('should provide a Migration.migrate() method', () => {
      expect(app.models.Migration).itself.to.respondTo('migrate');
    });
  });

  describe('migration', () => {
    // Set up a spy for each migration function.
    before(function setup() {
      this.spies = {
        m1Up: sinon.spy(m1, 'up'),
        m1Down: sinon.spy(m1, 'down'),
        m2Up: sinon.spy(m2, 'up'),
        m2Down: sinon.spy(m2, 'down'),
        m3Up: sinon.spy(m3, 'up'),
        m3Down: sinon.spy(m3, 'down'),
      };

      this.resetSpies = function resetSpies() {
        _.forEach(this.spies, (spy) => {
          spy.reset();
        });
      };

      this.expectNoDown = function expectNotDown() {
        expect(this.spies.m1Down).not.to.have.been.called;
        expect(this.spies.m2Down).not.to.have.been.called;
        expect(this.spies.m3Down).not.to.have.been.called;
      };

      this.expectNoUp = function expectNoUp() {
        expect(this.spies.m1Up).not.to.have.been.called;
        expect(this.spies.m2Up).not.to.have.been.called;
        expect(this.spies.m3Up).not.to.have.been.called;
      };
    });

    // Reset all the spies after each test.
    afterEach(function reset() {
      this.resetSpies();
    });

    // Delete all data after each test.
    beforeEach((done) => {
      Promise.all([
        app.models.Migration.destroyAll(),
        app.models.Migration.destroyAll(),
      ])
        .then(() => {
          done();
        })
        .catch(done);
    });

    describe('migrate', () => {
      it('should set a property on app to indicate that migrations are running', (done) => {
        expect(app.migrating).to.be.undefined;
        const promise = app.models.Migration.migrate();
        expect(app.migrating).to.be.true;
        promise.then(() => {
          expect(app.migrating).to.be.undefined;
          done();
        })
          .catch(done);
      });
    });

    describe('up', () => {
      it('should run all migration scripts', function run(done) {
        const self = this;
        app.models.Migration.migrate()
          .then(() => {
            expect(self.spies.m1Up).to.have.been.called;
            expect(self.spies.m2Up).to.have.been.calledAfter(self.spies.m1Up);
            expect(self.spies.m3Up).to.have.been.calledAfter(self.spies.m2Up);
            self.expectNoDown();
            done();
          })
          .catch(done);
      });
      it('should run migrations up to the specificed point only', function run(done) {
        const self = this;
        app.models.Migration.migrate('up', '0002-somechanges')
          .then(() => {
            expect(self.spies.m1Up).to.have.been.calledBefore(self.spies.m2Up);
            expect(self.spies.m2Up).to.have.been.calledAfter(self.spies.m1Up);
            expect(self.spies.m3Up).not.to.have.been.called;
            self.expectNoDown();
            done();
          })
          .catch(done);
      });
      it('should not rerun migrations that hae already been run', function run(done) {
        const self = this;
        app.models.Migration.migrate('up', '0002-somechanges')
          .then(() => {
            self.resetSpies();
            return app.models.Migration.migrate('up');
          })
          .then(() => {
            expect(self.spies.m1Up).not.to.have.been.called;
            expect(self.spies.m2Up).not.to.have.been.called;
            expect(self.spies.m3Up).to.have.been.called;
            self.expectNoDown();
            done();
          })
          .catch(done);
      });
    });

    describe('down', () => {
      it('should run all rollback scripts in reverse order', function run(done) {
        const self = this;
        app.models.Migration.migrate('up')
          .then(() => {
            self.expectNoDown();
            self.resetSpies();
            return app.models.Migration.migrate('down');
          })
          .then(() => {
            expect(self.spies.m3Down).to.have.been.calledBefore(self.spies.m2Down);
            expect(self.spies.m2Down).to.have.been.calledAfter(self.spies.m3Down);
            expect(self.spies.m1Down).to.have.been.calledAfter(self.spies.m2Down);
            self.expectNoUp();
            done();
          })
          .catch(done);
      });
      it('should run rollbacks up to the specificed point only', function run(done) {
        const self = this;
        app.models.Migration.migrate('up')
          .then(() => {
            self.expectNoDown();
            self.resetSpies();
            return app.models.Migration.migrate('down', '0001-initialize');
          })
          .then(() => {
            expect(self.spies.m3Down).to.have.been.called;
            expect(self.spies.m2Down).to.have.been.calledAfter(self.spies.m3Down);
            expect(self.spies.m1Down).not.to.have.been.called;
            self.expectNoUp();
            done();
          })
          .catch(done);
      });
      it('should not rerun rollbacks that hae already been run', function run(done) {
        const self = this;
        app.models.Migration.migrate('up')
          .then(() => app.models.Migration.migrate('down', '0001-initialize'))
          .then(() => {
            self.resetSpies();
            return app.models.Migration.migrate('down');
          })
          .then(() => {
            expect(self.spies.m3Down).to.not.have.been.called;
            expect(self.spies.m2Down).to.not.have.been.called;
            expect(self.spies.m1Down).to.have.been.called;
            self.expectNoUp();
            done();
          })
          .catch(done);
      });
      it('should rollback a single migration that has not already run', function run(done) {
        const self = this;
        app.models.Migration.migrate('up', '0002-somechanges')
          .then(() => {
            self.resetSpies();
            return app.models.Migration.migrate('down', '0003-morechanges');
          })
          .then(() => {
            expect(self.spies.m3Down).to.have.been.called;
            expect(self.spies.m2Down).to.not.have.been.called;
            expect(self.spies.m1Down).to.not.have.been.called;
            self.expectNoUp();
            done();
          })
          .catch(done);
      });
    });
  });
});
