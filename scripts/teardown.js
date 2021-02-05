const { exec } = require('../provider-utils/awscloudformation/utils/headless-mode');

module.exports = async function teardown() {
  console.log('amplify delete --force');
  await exec('bash', ['./scripts/headless/amplify-delete.sh']);
};
