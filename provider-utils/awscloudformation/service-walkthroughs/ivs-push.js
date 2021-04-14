const inquirer = require('inquirer');
const question = require('../../ivs-questions.json');
const headlessMode = require('../utils/headless-mode');

module.exports = {
  serviceQuestions,
};

async function serviceQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
  const projectMeta = context.amplify.getProjectMeta();
  // const projectDetails = context.amplify.getProjectDetails();
  // const defaultLocation =
  // path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
  // const defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  // const targetDir = amplify.pathManager.getBackendDirPath();
  const props = {};
  let nameDict = {};
  const defaultName = 'mylivestream';

  const { inputs } = question.video;
  const { payload } = context.parameters.options;
  const args = payload ? JSON.parse(payload) : {};

  const nameProject = [
    {
      type: inputs[0].type,
      name: inputs[0].key,
      message: inputs[0].question,
      validate: amplify.inputValidation(inputs[0]),
      default: defaultName,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[0].key,
          value: args.resourceName ? args.resourceName : defaultName,
        });
      },
    },
  ];

  if (resourceName) {
    nameDict.resourceName = resourceName;
    props.shared = nameDict;
  } else {
    nameDict = await inquirer.prompt(nameProject);
    props.shared = nameDict;
  }
  props.shared.bucket = projectMeta.providers.awscloudformation.DeploymentBucketName;
  const createChannel = [
    {
      type: inputs[1].type,
      name: inputs[1].key,
      message: inputs[1].question,
      choices: inputs[1].options,
      default: 'STANDARD',
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[1].key,
          value: args.channelQuality ? args.channelQuality : 'STANDARD',
        });
      },
    },
    {
      type: inputs[2].type,
      name: inputs[2].key,
      message: inputs[2].question,
      choices: inputs[2].options,
      default: 'LOW',
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[2].key,
          value: args.channelLatency ? args.channelLatency : 'LOW',
        });
      },
    },
  ];

  const channelQuestions = await inquirer.prompt(createChannel);
  props.channel = channelQuestions;

  return props;
}
