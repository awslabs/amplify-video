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
  let advancedAnswers = {};
  let mediaLiveAnswers = {};
  let mediaPackageAnswers;
  let cloudFrontAnswers = {};
  const props = {};
  let defaults = {};
  defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  defaults.resourceName = 'mylivestream';

  // TODO: find a way to use default in new question files
  try {
    const oldValues = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/props.json`));
    Object.assign(defaults, oldValues);
  } catch (err) {
    // Do nothing
  }

  const { payload } = context.parameters.options;
  const args = payload ? JSON.parse(payload) : {};

  // question dictionaries taken by inquirer
  // project name
  const nameProject = [
    {
      type: question.resourceName.type,
      name: question.resourceName.key,
      message: question.resourceName.question,
      validate: amplify.inputValidation(question.resourceName),
      default: defaults.resourceName,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.resourceName.key,
          value: args.resourceName ? args.resourceName : defaults.resourceName,
        });
      },
    }];

  // prompt for advanced options
  const advanced = [
    {
      type: question.advancedChoice.type,
      name: question.advancedChoice.key,
      message: question.advancedChoice.question,
      default: defaults.advanced[question.advancedChoice.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.advancedChoice.key,
          value: defaults.advanced[question.advancedChoice.key],
        });
      },
    },
  ];

  // advanced options (currently only segmentation settings)
  const advancedQuestions = [
    {
      type: question.gopSize.type,
      name: question.gopSize.key,
      message: question.gopSize.question,
      validate: amplify.inputValidation(question.gopSize),
      default: defaults.advanced[question.gopSize.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.gopSize.key,
          value: defaults.advanced[question.gopSize.key],
        });
      },
    },
    {
      type: question.gopPerSegment.type,
      name: question.gopPerSegment.key,
      message: question.gopPerSegment.question,
      validate: amplify.inputValidation(question.gopPerSegment),
      default: defaults.advanced[question.gopPerSegment.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.gopPerSegment.key,
          value: defaults.advanced[question.gopPerSegment.key],
        });
      },
    },
    {
      type: question.segsPerPlist.type,
      name: question.segsPerPlist.key,
      message: question.segsPerPlist.question,
      validate: amplify.inputValidation(question.segsPerPlist),
      default: defaults.advanced[question.segsPerPlist.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.segsPerPlist.key,
          value: defaults.advanced[question.segsPerPlist.key],
        });
      },
    },
  ];

  const mediaLiveQuestions = [
    {
      type: question.securityGroup.type,
      name: question.securityGroup.key,
      message: question.securityGroup.question,
      validate: amplify.inputValidation(question.securityGroup),
      default: defaults.mediaLive[question.securityGroup.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.securityGroup.key,
          value: defaults.mediaLive[question.securityGroup.key],
        });
      },
    },
    {
      type: question.ingestType.type,
      name: question.ingestType.key,
      message: question.ingestType.question,
      choices: question.ingestType.options,
      default: defaults.mediaLive[question.ingestType.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.ingestType.key,
          value: defaults.mediaLive[question.ingestType.key],
        });
      },
    },
    {
      type: question.encodingProfile.type,
      name: question.encodingProfile.key,
      message: question.encodingProfile.question,
      choices: question.encodingProfile.options,
      default: defaults.mediaLive[question.encodingProfile.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.encodingProfile.key,
          value: defaults.mediaLive[question.encodingProfile.key],
        });
      },
    },
    {
      type: question.autoStart.type,
      name: question.autoStart.key,
      message: question.autoStart.question,
      choices: question.autoStart.options,
      default: defaults.mediaLive[question.autoStart.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.autoStart.key,
          value: defaults.mediaLive[question.autoStart.key],
        });
      },
    },
  ];

  const mp4Questions = [
    {
      type: question.mp4URL.type,
      name: question.mp4URL.key,
      message: question.mp4URL.question,
      default: defaults.advanced[question.mp4URL.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.mp4URL.key,
          value: defaults.advanced[question.mp4URL.key],
        });
      },
    },
  ];

  const mediaPackageQuestions = [
    {
      type: question.endpoints.type,
      name: question.endpoints.key,
      message: question.endpoints.question,
      choices: question.endpoints.options,
      default: defaults.mediaPackage[question.endpoints.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.endpoints.key,
          value: defaults.mediaPackage[question.endpoints.key],
        });
      },
    },
    {
      type: question.startOverWindow.type,
      name: question.startOverWindow.key,
      message: question.startOverWindow.question,
      validate: amplify.inputValidation(question.startOverWindow),
      default: defaults.mediaPackage[question.startOverWindow.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.startOverWindow.key,
          value: defaults.mediaPackage[question.startOverWindow.key],
        });
      },
    },
  ];

  const mediaStorage = [
    {
      type: question.storageType.type,
      name: question.storageType.key,
      message: question.storageType.question,
      choices: question.storageType.options,
      default: defaults.mediaStorage[question.storageType.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.storageType.key,
          value: defaults.mediaStorage[question.storageType.key],
        });
      },
    },
  ];

  const cloudFrontEnable = [
    {
      type: question.enableDistribution.type,
      name: question.enableDistribution.key,
      message: question.enableDistribution.question,
      choices: question.enableDistribution.options,
      default: defaults.cloudFront[question.enableDistribution.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.enableDistribution.key,
          value: defaults.cloudFront[question.enableDistribution.key],
        });
      },
    },
  ];

  const cloudFrontQuestions = [
    {
      type: question.priceClass.type,
      name: question.priceClass.key,
      message: question.priceClass.question,
      choices: question.priceClass.options,
      default: defaults.cloudFront[question.priceClass.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.priceClass.key,
          value: defaults.cloudFront[question.priceClass.key],
        });
      },
    },
    {
      type: question.sBucketLogs.type,
      name: question.sBucketLogs.key,
      message: question.sBucketLogs.question,
      validate: amplify.inputValidation(question.sBucketLogs),
      default: defaults.cloudFront[question.sBucketLogs.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.sBucketLogs.key,
          value: defaults.cloudFront[question.sBucketLogs.key],
        });
      },
    },
    {
      type: question.sLogPrefix.type,
      name: question.sLogPrefix.key,
      message: question.sLogPrefix.question,
      validate: amplify.inputValidation(question.sLogPrefix),
      default: defaults.cloudFront[question.sLogPrefix.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.sLogPrefix.key,
          value: defaults.cloudFront[question.sLogPrefix.key],
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
