const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const question = require('../../livestream-questions.json');
const headlessMode = require('../utils/headless-mode');

module.exports = {
  serviceQuestions,
};

async function serviceQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
  const defaultLocation = path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
  let resource = {};
  const targetDir = amplify.pathManager.getBackendDirPath();
  const projectDetails = context.amplify.getProjectDetails();
  let advancedAnswers = {};
  let mediaLiveAnswers = {};
  let mediaPackageAnswers;
  let cloudFrontAnswers = {};
  const props = {};
  let defaults = {};
  defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  defaults.resourceName = 'mylivestream';
  try {
    const oldValues = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/${projectDetails.localEnvInfo.envName}-props.json`));
    Object.assign(defaults, oldValues);
  } catch (err) {
    // Do nothing
  }

  const { inputs } = question.video;
  const { payload } = context.parameters.options;
  const args = payload ? JSON.parse(payload) : {};

  // question dictionaries taken by inquirer
  // project name
  const nameProject = [
    {
      type: inputs[0].type,
      name: inputs[0].key,
      message: inputs[0].question,
      validate: amplify.inputValidation(inputs[0]),
      default: defaults.resourceName,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[0].key,
          value: args.resourceName ? args.resourceName : defaults.resourceName,
        });
      },
    }];

  // prompt for advanced options
  const advanced = [
    {
      type: inputs[16].type,
      name: inputs[16].key,
      message: inputs[16].question,
      default: defaults.advanced[inputs[16].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[16].key,
          value: defaults.advanced[inputs[16].key],
        });
      },
    },
  ];

  // advanced options (currently only segmentation settings)
  const advancedQuestions = [
    {
      type: inputs[1].type,
      name: inputs[1].key,
      message: inputs[1].question,
      validate: amplify.inputValidation(inputs[1]),
      default: defaults.advanced[inputs[1].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[1].key,
          value: defaults.advanced[inputs[1].key],
        });
      },
    },
    {
      type: inputs[2].type,
      name: inputs[2].key,
      message: inputs[2].question,
      validate: amplify.inputValidation(inputs[2]),
      default: defaults.advanced[inputs[2].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[2].key,
          value: defaults.advanced[inputs[2].key],
        });
      },
    },
    {
      type: inputs[3].type,
      name: inputs[3].key,
      message: inputs[3].question,
      validate: amplify.inputValidation(inputs[3]),
      default: defaults.advanced[inputs[3].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[3].key,
          value: defaults.advanced[inputs[3].key],
        });
      },
    },
  ];

  const mediaLiveQuestions = [
    {
      type: inputs[4].type,
      name: inputs[4].key,
      message: inputs[4].question,
      validate: amplify.inputValidation(inputs[4]),
      default: defaults.mediaLive[inputs[4].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[4].key,
          value: defaults.mediaLive[inputs[4].key],
        });
      },
    },
    {
      type: inputs[5].type,
      name: inputs[5].key,
      message: inputs[5].question,
      choices: inputs[5].options,
      default: defaults.mediaLive[inputs[5].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[5].key,
          value: defaults.mediaLive[inputs[5].key],
        });
      },
    },
    {
      type: inputs[6].type,
      name: inputs[6].key,
      message: inputs[6].question,
      choices: inputs[6].options,
      default: defaults.mediaLive[inputs[6].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[6].key,
          value: defaults.mediaLive[inputs[6].key],
        });
      },
    },
    {
      type: inputs[7].type,
      name: inputs[7].key,
      message: inputs[7].question,
      choices: inputs[7].options,
      default: defaults.mediaLive[inputs[7].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[7].key,
          value: defaults.mediaLive[inputs[7].key],
        });
      },
    },
  ];

  const mp4Questions = [
    {
      type: inputs[17].type,
      name: inputs[17].key,
      message: inputs[17].question,
      default: defaults.advanced[inputs[17].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[17].key,
          value: defaults.advanced[inputs[17].key],
        });
      },
    },
  ];

  const mediaPackageQuestions = [
    {
      type: inputs[8].type,
      name: inputs[8].key,
      message: inputs[8].question,
      choices: inputs[8].options,
      default: defaults.mediaPackage[inputs[8].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[8].key,
          value: defaults.mediaPackage[inputs[8].key],
        });
      },
    },
    {
      type: inputs[9].type,
      name: inputs[9].key,
      message: inputs[9].question,
      validate: amplify.inputValidation(inputs[9]),
      default: defaults.mediaPackage[inputs[9].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[9].key,
          value: defaults.mediaPackage[inputs[9].key],
        });
      },
    },
  ];

  const mediaStorage = [
    {
      type: inputs[15].type,
      name: inputs[15].key,
      message: inputs[15].question,
      choices: inputs[15].options,
      default: defaults.mediaStorage[inputs[15].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[15].key,
          value: defaults.mediaStorage[inputs[15].key],
        });
      },
    },
  ];

  const cloudFrontEnable = [
    {
      type: inputs[11].type,
      name: inputs[11].key,
      message: inputs[11].question,
      choices: inputs[11].options,
      default: defaults.cloudFront[inputs[11].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[11].key,
          value: defaults.cloudFront[inputs[11].key],
        });
      },
    },
  ];

  const cloudFrontQuestions = [
    {
      type: inputs[12].type,
      name: inputs[12].key,
      message: inputs[12].question,
      choices: inputs[12].options,
      default: defaults.cloudFront[inputs[12].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[12].key,
          value: defaults.cloudFront[inputs[12].key],
        });
      },
    },
    {
      type: inputs[13].type,
      name: inputs[13].key,
      message: inputs[13].question,
      validate: amplify.inputValidation(inputs[13]),
      default: defaults.cloudFront[inputs[13].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[13].key,
          value: defaults.cloudFront[inputs[13].key],
        });
      },
    },
    {
      type: inputs[14].type,
      name: inputs[14].key,
      message: inputs[14].question,
      validate: amplify.inputValidation(inputs[14]),
      default: defaults.cloudFront[inputs[14].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[14].key,
          value: defaults.cloudFront[inputs[14].key],
        });
      },
    },
  ];
  if (resourceName) {
    resource.resourceName = resourceName;
  } else {
    resource = await inquirer.prompt(nameProject);
  }

  // main question control flow
  const answers = {};

  answers.resourceName = resource.name;

  const advancedEnable = await inquirer.prompt(advanced);
  if (advancedEnable.advancedChoice === false) {
    advancedAnswers.gopSize = '1';
    advancedAnswers.gopPerSegment = '2';
    advancedAnswers.segsPerPlist = '3';
    advancedAnswers.advancedChoice = false;
  } else {
    advancedAnswers = await inquirer.prompt(advancedQuestions);
    advancedAnswers.advancedChoice = true;
  }

  mediaLiveAnswers = await inquirer.prompt(mediaLiveQuestions);
  if (mediaLiveAnswers.ingestType === 'MP4_FILE') {
    const mp4Answers = await inquirer.prompt(mp4Questions);
    mediaLiveAnswers.mp4URL = mp4Answers.mp4URL;
  }
  const mediaStorageAnswers = await inquirer.prompt(mediaStorage);
  if (mediaStorageAnswers.storageType === 'mPackageStore' || mediaStorageAnswers.storageType === 'mPackage') {
    mediaPackageAnswers = await inquirer.prompt(mediaPackageQuestions);
    props.mediaPackage = mediaPackageAnswers;
    // TODO change this to choice prompt
    const cloudfrontenable = await inquirer.prompt(cloudFrontEnable);
    if (cloudfrontenable.enableDistribution === 'YES') {
      cloudFrontAnswers = await inquirer.prompt(cloudFrontQuestions);
    }
    cloudFrontAnswers.enableDistribution = cloudfrontenable.enableDistribution;
  } else {
    cloudFrontAnswers.enableDistribution = 'NO';
  }

  // export stored answers
  props.shared = answers;
  props.advanced = advancedAnswers;
  props.mediaLive = mediaLiveAnswers;
  props.mediaPackage = mediaPackageAnswers;
  props.mediaStorage = mediaStorageAnswers;
  props.cloudFront = cloudFrontAnswers;

  return props;
}
