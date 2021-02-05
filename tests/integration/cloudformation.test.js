const path = require('path');
const glob = require('glob');
const AWS = require('aws-sdk');
const fs = require('fs');

test('Should validate CloudFormation templates', async () => {
  let directoryPath = path.join(__dirname, '../../amplify/backend/video/**/build/**/*.template');
  if (process.env.NODE_ENV !== 'test' && process.env.AMP_PATH) {
    directoryPath = path.join(__dirname, `../../${process.env.AMP_PATH}/amplify/backend/video/**/build/**/*.template`);
  }
  const files = glob.sync(directoryPath);
  const cloudformation = new AWS.CloudFormation();

  if (files.length === 0) {
    console.log('No templates found. Passing to next test.');
    return;
  }

  await Promise.all(files.map(async (filePath) => {
    try {
      console.log(`Testing: ${filePath}`);
      await cloudformation.validateTemplate({
        TemplateBody: fs.readFileSync(filePath,
          { encoding: 'utf8', flag: 'r' }),
      }).promise();
    } catch (error) {
      throw (new Error(`template path: ${filePath}\n${error}`));
    }
  }));
});
