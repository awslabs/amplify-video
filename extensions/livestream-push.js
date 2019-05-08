const inquirer = require('inquirer');
const {stageVideo} = require('./helpers/video-staging');
const fs = require('fs-extra');
const chalk = require('chalk');


module.exports = (context) => {
  context.createLiveStream = async () => {
    await addLivestream(context);
  };
  context.pushStaticFiles = async () => {
    await resetupLivestream(context);
  };
  context.updateLiveStream = async () => {
    await updateLiveStream(context);
  };
  context.removeLiveStream = async () => {
    await removeLiveStream(context);
  };
  context.updateWithProps = async (options, props) => {
    await stageVideo(context, options, result, 'update');
  };
};

async function removeLiveStream(context) {
  context.amplify.removeResource(context, 'video');
}

async function updateLiveStream(context) {
  const options = {
    service: 'video',
    serviceType: 'livestream',
    providerPlugin: 'awscloudformation',
  };

  const props = {};
  const chooseProject = [
    {
      type: 'list',
      name: 'resourceName',
      message: 'Choose what project you want to update?',
      choices: Object.keys(context.amplify.getProjectMeta().video),
      default: Object.keys(context.amplify.getProjectMeta().video)[0],
    },
  ];

  props.shared = await inquirer.prompt(chooseProject);

  const result = await serviceQuestions(context, props.shared.resourceName);

  await stageVideo(context, options, result, 'update');
}

async function addLivestream(context) {
  const options = {
    service: 'video',
    serviceType: 'livestream',
    providerPlugin: 'awscloudformation',
  };

  const result = await serviceQuestions(context);
  await stageVideo(context, options, result, 'add');
}

async function serviceQuestions(context, resourceName) {
  const { amplify } = context;
  const projectMeta = context.amplify.getProjectMeta();
  let resource = {};
  const targetDir = amplify.pathManager.getBackendDirPath();
  let mediaPackageAnswers;
  let cloudFrontAnswers = {};
  const props = {};
  let defaults = {};

  defaults = JSON.parse(fs.readFileSync(`${__dirname}/livestream-defaults.json`));
  defaults.shared.resourceName = amplify.getProjectDetails().projectConfig.projectName;
  try {
    const oldValues = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/props.json`));
    Object.assign(defaults, oldValues);
  } catch (err) {
    // Do nothing
  }

  const serviceMetadata = JSON.parse(fs.readFileSync(`${__dirname}/livestream-questions.json`)).video;

  const { inputs } = serviceMetadata;

  const nameProject = [
    {
      type: inputs[0].type,
      name: inputs[0].key,
      message: inputs[0].question,
      validate: amplify.inputValidation(inputs[0]),
      default: defaults.shared.resourceName,
    }];

  const defaultQuestions = [
    {
      type: inputs[1].type,
      name: inputs[1].key,
      message: inputs[1].question,
      validate: amplify.inputValidation(inputs[1]),
      default: defaults.shared[inputs[1].key],
    },
    {
      type: inputs[2].type,
      name: inputs[2].key,
      message: inputs[2].question,
      validate: amplify.inputValidation(inputs[2]),
      default: defaults.shared[inputs[2].key],
    },
    {
      type: inputs[3].type,
      name: inputs[3].key,
      message: inputs[3].question,
      validate: amplify.inputValidation(inputs[3]),
      default: defaults.shared[inputs[3].key],
    },
  ];

  const mediaLiveQustions = [
    {
      type: inputs[4].type,
      name: inputs[4].key,
      message: inputs[4].question,
      validate: amplify.inputValidation(inputs[4]),
      default: defaults.mediaLive[inputs[4].key],
    },
    {
      type: inputs[5].type,
      name: inputs[5].key,
      message: inputs[5].question,
      choices: inputs[5].options,
      default: defaults.mediaLive[inputs[5].key],
    },
    {
      type: inputs[6].type,
      name: inputs[6].key,
      message: inputs[6].question,
      choices: inputs[6].options,
      default: defaults.mediaLive[inputs[6].key],
    },
    {
      type: inputs[7].type,
      name: inputs[7].key,
      message: inputs[7].question,
      choices: inputs[7].options,
      default: defaults.mediaLive[inputs[7].key],
    },
  ];

  const mediaPackageQuestions = [
    {
      type: inputs[8].type,
      name: inputs[8].key,
      message: inputs[8].question,
      choices: inputs[8].options,
      default: defaults.mediaPackage[inputs[8].key],
    },
    {
      type: inputs[9].type,
      name: inputs[9].key,
      message: inputs[9].question,
      validate: amplify.inputValidation(inputs[9]),
      default: defaults.mediaPackage[inputs[9].key],
    },
  ];

  const mediaStorage = [
    {
      type: inputs[15].type,
      name: inputs[15].key,
      message: inputs[15].question,
      choices: inputs[15].options,
      default: defaults.mediaStorage[inputs[15].key],
    },
  ];

  const cloudFrontEnable = [
    {
      type: inputs[11].type,
      name: inputs[11].key,
      message: inputs[11].question,
      choices: inputs[11].options,
      default: defaults.cloudFront[inputs[11].key],
    },
  ];

  const cloudFrontQuestions = [
    {
      type: inputs[12].type,
      name: inputs[12].key,
      message: inputs[12].question,
      choices: inputs[12].options,
      default: defaults.cloudFront[inputs[12].key],
    },
    {
      type: inputs[13].type,
      name: inputs[13].key,
      message: inputs[13].question,
      validate: amplify.inputValidation(inputs[13]),
      default: defaults.cloudFront[inputs[13].key],
    },
    {
      type: inputs[14].type,
      name: inputs[14].key,
      message: inputs[14].question,
      validate: amplify.inputValidation(inputs[14]),
      default: defaults.cloudFront[inputs[14].key],
    },
  ];
  if (resourceName) {
    resource.name = resourceName;
  } else {
    resource = await inquirer.prompt(nameProject);
  }

  const answers = await inquirer.prompt(defaultQuestions);
  answers.bucket = projectMeta.providers.awscloudformation.DeploymentBucketName;

  answers.resourceName = resource.name;

  const mediaLiveAnswers = await inquirer.prompt(mediaLiveQustions);
  const mediaStorageAnswers = await inquirer.prompt(mediaStorage);
  if (mediaStorageAnswers.storageType === 'mPackageStore' || mediaStorageAnswers.storageType === 'mPackage') {
    mediaPackageAnswers = await inquirer.prompt(mediaPackageQuestions);
    props.mediaPackage = mediaPackageAnswers;
    const cloudfrontenable = await inquirer.prompt(cloudFrontEnable);
    if (cloudfrontenable.enableDistrubtion === 'YES') {
      cloudFrontAnswers = await inquirer.prompt(cloudFrontQuestions);
    }
    cloudFrontAnswers.enableDistrubtion = cloudfrontenable.enableDistrubtion;
  } else {
    cloudFrontAnswers.enableDistrubtion = 'NO';
  }


  props.shared = answers;
  props.mediaLive = mediaLiveAnswers;
  props.mediaPackage = mediaPackageAnswers;
  props.mediaStorage = mediaStorageAnswers;
  props.cloudFront = cloudFrontAnswers;

  return props;
}
