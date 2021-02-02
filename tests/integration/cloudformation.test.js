const path = require('path');
const glob = require('glob');
const AWS = require('aws-sdk');
const fs = require('fs');

test('Should validate CloudFormation templates', async () => {
  const directoryPath = path.join(__dirname, '../../amplify/backend/video/**/build/**/*.template');
  const files = glob.sync(directoryPath);
  const cloudformation = new AWS.CloudFormation();

  await Promise.all(files.map(async (filePath) => {
    try {
      await cloudformation.validateTemplate({
        TemplateBody: fs.readFileSync(filePath,
          { encoding: 'utf8', flag: 'r' }),
      }).promise();
    } catch (error) {
      throw (new Error(`template path: ${filePath}\n${error}`));
    }
  }));
});
