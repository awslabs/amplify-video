const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const ivsQuestions = require('../../ivs-questions.json');

module.exports = {
  serviceQuestions,
};

async function serviceQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
  const projectMeta = context.amplify.getProjectMeta();
  const defaultLocation = path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
  const defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  const targetDir = amplify.pathManager.getBackendDirPath();
  const props = {};
  let nameDict = {};

  const { questions } = ivsQuestions.video;
  const nameProject = [
    {
      name: 'resourceName',
      message: questions.resourceName.question,
      validate: amplify.inputValidation(questions.resourceName),
      default: 'mylivestream',
    },
  ];

  if (resourceName) {
    nameDict.resourceName = resourceName;
    props.shared = nameDict;
    try {
      const oldValues = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/props.json`));
      Object.assign(defaults, oldValues);
    } catch (err) {
      // Do nothing
    }
  } else {
    nameDict = await inquirer.prompt(nameProject);
    props.shared = nameDict;
  }
  props.shared.bucket = projectMeta.providers.awscloudformation.DeploymentBucketName;
  const createChannel = [
    {
      name: 'channelQuality',
      type: questions.channelQuality.type,
      message: questions.channelQuality.question,
      choices: questions.channelQuality.options,
      default: defaults.channel.channelQuality,
    },
    {
      name: 'channelLatency',
      type: questions.channelLatency.type,
      message: questions.channelLatency.question,
      choices: questions.channelLatency.options,
      default: defaults.channel.channelLatency,
    },
    {
      name: 'privateChannel',
      type: questions.privateChannel.type,
      message: questions.privateChannel.question,
      default: defaults.channel.privateChannel,
    },
  ];

  const channelQuestions = await inquirer.prompt(createChannel);
  props.channel = channelQuestions;

  return props;
}
