module.exports = {
  verbose: true,
  testEnvironment: 'node',
  globalSetup: './scripts/setup.js',
  globalTeardown: process.env.NODE_ENV === 'test' ? './scripts/teardown.js' : null, // Jest automatically set NODE_ENV to test if it's not already set to something else.
};
