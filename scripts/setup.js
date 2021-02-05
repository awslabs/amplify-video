const { exec } = require('../provider-utils/awscloudformation/utils/headless-mode');

module.exports = async function setup() {
  console.log('\namplify init');
  await exec('bash', ['./scripts/headless/init-new-project.sh']);
  console.log('\namplify add video');
  await exec('bash', ['./scripts/headless/add-ivs.sh']);
};
