const path = require('path');
const glob = require('glob');
const AWS = require('aws-sdk');
const fs = require('fs');

AWS.config.update({ region: 'us-west-2' });

const cloudformation = new AWS.CloudFormation();

test('Should validate CloudFormation templates', async () => {
  let directoryPath = path.join(__dirname, '../../amplify/backend/video/**/build/**/*.template');
  if (process.env.NODE_ENV !== 'test' && process.env.AMP_PATH) {
    directoryPath = path.join(__dirname, `../../${process.env.AMP_PATH}/amplify/backend/video/**/build/**/*.template`);
  }
  const files = glob.sync(directoryPath);

  if (files.length === 0) {
    console.log('No templates found. Passing to next test.');
    return;
  }

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

test('Should validate CloudFormation stack status', async () => {
  let directoryPath = path.join(__dirname, '../../amplify/team-provider-info.json');
  if (process.env.NODE_ENV !== 'test' && process.env.AMP_PATH) {
    directoryPath = path.join(__dirname, `../../${process.env.AMP_PATH}/amplify/team-provider-info.json`);
  }
  const teamProvider = JSON.parse(fs.readFileSync(directoryPath, 'utf8'));
  const stackName = teamProvider.dev.awscloudformation.StackName;

  const stacksDescription = await cloudformation.describeStacks({ StackName: stackName }).promise();
  const stackStatus = stacksDescription.Stacks[0].StackStatus;
  try {
    expect(stackStatus).toBe('UPDATE_COMPLETE');
  } catch (e) {
    expect(stackStatus).toBe('CREATE_COMPLETE');
  }
});
