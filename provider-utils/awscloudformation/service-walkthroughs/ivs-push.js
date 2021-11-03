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

  const { payload } = context.parameters.options;
  const args = payload ? JSON.parse(payload) : {};

  const nameProject = [
    {
      type: question.resourceName.type,
      name: question.resourceName.key,
      message: question.resourceName.question,
      validate: amplify.inputValidation(question.resourceName),
      default: question.resourceName.default,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.resourceName.key,
          value: args.resourceName ? args.resourceName : question.resourceName.default,
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
      type: question.channelQuality.type,
      name: question.channelQuality.key,
      message: question.channelQuality.question,
      choices: question.channelQuality.options,
      default: question.channelQuality.default,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.channelQuality.key,
          value: args.channelQuality ? args.channelQuality : question.channelQuality.default,
        });
      },
    },
    {
      type: question.channelLatency.type,
      name: question.channelLatency.key,
      message: question.channelLatency.question,
      choices: question.channelLatency.options,
      default: question.channelLatency.default,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.channelLatency.key,
          value: args.channelLatency ? args.channelLatency : question.channelLatency.default,
        });
      },
    }
  ];

  
  const statusReporting = [
    {
      type: question.reportStatus.type,
      name: question.reportStatus.key,
      message: question.reportStatus.question,
      choices: question.reportStatus.options,
      default: question.reportStatus.default,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.reportStatus.key,
          value: args.reportStatus ? args.reportStatus : question.reportStatus.default,
        });
      },
    }
    ]
    
    const statusLambda = [
        {
      type: question.reportStatusLambda.type,
      name: question.reportStatusLambda.key,
      message: question.reportStatusLambda.question,
      choices: question.reportStatusLambda.options,
      default: question.reportStatusLambda.default,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.reportStatusLambda.key,
          value: args.reportStatusLambda ? args.reportStatusLambda : question.reportStatusLambda.default,
        });
      },
    }
        
      ]
      
  const channelQuestions = await inquirer.prompt(createChannel);
  props.channel = channelQuestions;

  const statusQuestions = await inquirer.prompt(statusReporting);
  props.status = statusQuestions
  
  
  if(statusQuestions.reportStatus === true){
    const statusQuestionsLambda = await inquirer.prompt(statusLambda);
    props.status.lambda = statusQuestionsLambda.reportStatusLambda
  }
  
  return props;
}