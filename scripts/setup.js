const fs = require('fs');
const path = require('path');
const { exec } = require('../provider-utils/awscloudformation/utils/headless-mode');

module.exports = async function setup() {
  if (process.env.NODE_ENV !== 'test') {
    const directoryPath = path.join(__dirname, `../${process.env.AMP_PATH}/amplify`);
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`No amplify project found, make sure to set AMP_PATH with correct path.\nActual path: ${directoryPath}`);
    }
  } else {
    await executeScripts();
  }
};

async function executeScripts() {
  console.log('\namplify init');
  await exec('bash', ['./scripts/headless/init-new-project.sh']);
  console.log('\namplify add video');
  await exec('bash', ['./scripts/headless/add-ivs.sh']);
  console.log('\namplify push');
  await exec('bash', ['./scripts/headless/amplify-push.sh']);
}
