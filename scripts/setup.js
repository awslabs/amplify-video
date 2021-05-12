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
  try {
    console.log('\namplify init');
    await exec('bash', ['./scripts/headless/init-new-project.sh']);
    let params = '';
    if (process.env.COVERAGE === 'full') {
      params = ' full-coverage';
    }
    await exec('node', [`./scripts/gen-test-payload/index.js${params}`]);
    console.log('\namplify add video');
    const scriptsFolder = './scripts/gen-test-payload/output';
    await Promise.all(fs.readdirSync(scriptsFolder).map(async (script) => {
      if (/(^\w+-\d+\.sh$)/.test(script)) {
        return await exec('bash', [`${scriptsFolder}/${script}`]);
      }
    }));
    console.log('\namplify push');
    await exec('bash', ['./scripts/headless/amplify-push.sh']);
  } catch (error) {
    await exec('bash', ['./scripts/headless/amplify-delete.sh']);
    throw (new Error(error));
  }
}
