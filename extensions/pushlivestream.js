const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const chalk = require('chalk');


module.exports = context => {
  context.createLiveStream = async () => {
    await addLivestream(context);
  }
  context.pushStaticFiles = async () => {
    await resetupLivestream(context);
  }
  context.updateLiveStream = async() => {
    await updateLiveStream(context);
  }
  context.removeLiveStream = async() => {
    await removeLiveStream(context);
  }
}


async function removeLiveStream(context){
  context.amplify.removeResource(context, 'Elemental');
}

async function resetupLivestream(context){
  let options = {
    service: 'Elemental',
    providerPlugin: 'awscloudformation'
  };

  let props = {};

  const chooseProject = [
    {
      type: 'list',
      name: 'resourceName',
      message: 'Choose what project you want to push the default templates to s3 again?',
      choices: Object.keys(context.amplify.getProjectMeta().Elemental),
      default: Object.keys(context.amplify.getProjectMeta().Elemental)[0],
    }
  ];

  props.shared = await inquirer.prompt(chooseProject);

  await copyFilesToS3(context, options, props);

  console.log(chalk.bold("Your S3 bucket has been setup."));
}

async function updateLiveStream(context){
  let options = {
    service: 'Elemental',
    providerPlugin: 'awscloudformation'
  };

  let props = {};
  const chooseProject = [
    {
      type: 'list',
      name: 'resourceName',
      message: 'Choose what project you want to update?',
      choices: Object.keys(context.amplify.getProjectMeta().Elemental),
      default: Object.keys(context.amplify.getProjectMeta().Elemental)[0],
    }
  ];

  props.shared = await inquirer.prompt(chooseProject);

  const result = await serviceQuestions(context, props.shared.resourceName);

  await copyFilesToLocal(context, options, result);
  await copyFilesToS3(context, options, result);
}

async function addLivestream(context){
  let options = {
    service: 'Elemental',
    providerPlugin: 'awscloudformation'
  };
  
  const result = await serviceQuestions(context);
  await copyFilesToLocal(context, options, result);
  await copyFilesToS3(context, options, result);
}

async function copyFilesToS3(context, options, props){
  const { amplify } = context;
  const projectConfig = amplify.getProjectConfig();
  const targetDir = amplify.pathManager.getBackendDirPath();
  const targetBucket = amplify.getProjectMeta().providers.awscloudformation.DeploymentBucketName;
  const provider = require(projectConfig.providers[options.providerPlugin]);
  const aws = await provider.getConfiguredAWSClient(context);
  const s3Client = new aws.S3();
  const distributionDirPath = `${targetDir}/Elemental/${props.shared.resourceName}/src/`;
  let fileuploads = fs.readdirSync(distributionDirPath);

  fileuploads.forEach((filePath) => {
    uploadFile(s3Client, targetBucket, distributionDirPath, filePath);
  });
}

async function uploadFile(s3Client, hostingBucketName, distributionDirPath, filePath) {
  let relativeFilePath = path.relative(distributionDirPath, filePath);

  relativeFilePath = relativeFilePath.replace(/\\/g, '/');

  const fileStream = fs.createReadStream(`${distributionDirPath}/${filePath}`);
  const contentType = mime.lookup(relativeFilePath);
  const uploadParams = {
    Bucket: hostingBucketName,
    Key: `src/${filePath}`,
    Body: fileStream,
    ContentType: contentType || 'text/plain',
    ACL: 'public-read',
  };

  s3Client.upload(uploadParams, (err, data) => {
    if(err){
      console.log(chalk.bold("Failed uploading object to S3. Check your connection and try to run amplify livestream setup"));
    }
  });
}

async function copyFilesToLocal(context, options, props){
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = __dirname;

  const copyJobs = [
    {
        dir: pluginDir,
        template: `cloudformation-templates/live-workflow.json.ejs`,
        target: `${targetDir}/Elemental/${props.shared.resourceName}/${props.shared.resourceName}-live-workflow-template.json`,
    }
  ];

  context.amplify.copyBatch(context, copyJobs, props);

  let fileuploads = fs.readdirSync(`${pluginDir}/cloudformation-templates/src/`);

  if (!fs.existsSync(`${targetDir}/Elemental/${props.shared.resourceName}/src/`)){
    fs.mkdirSync(`${targetDir}/Elemental/${props.shared.resourceName}/src/`);
  }

  fileuploads.forEach((filePath) => {
    fs.copyFileSync(`${pluginDir}/cloudformation-templates/src/${filePath}`, `${targetDir}/Elemental/${props.shared.resourceName}/src/${filePath}`);
  });
  
  context.amplify.updateamplifyMetaAfterResourceAdd(
    "Elemental",
    props.shared.resourceName,
    options,
  );

}

async function serviceQuestions(context, resourceName){
  const { amplify } = context;
  let answers;
  let mediaLiveAnswers;
  let mediaStoreAnswers;
  const targetDir = amplify.pathManager.getBackendDirPath();
  let mediaPackageAnswers;
  let cloudFrontAnswers = {};
  let props = {};
  serviceMetadata = JSON.parse(fs.readFileSync(`${__dirname}/questions.json`))['Elemental'];

  const { inputs } = serviceMetadata;

  const pluginDir = __dirname;

  let defaultQuestions;
  
  if (resourceName){
    defaultQuestions = [
      {
        type: inputs[1].type,
        name: inputs[1].key,
        message: inputs[1].question,
        validate: amplify.inputValidation(inputs[1]),
        default: '1',
      },
      {
        type: inputs[2].type,
        name: inputs[2].key,
        message: inputs[2].question,
        validate: amplify.inputValidation(inputs[2]),
        default: '1',
      },
      {
        type: inputs[3].type,
        name: inputs[3].key,
        message: inputs[3].question,
        validate: amplify.inputValidation(inputs[2]),
        default: '3',
      }
    ];
  } else {
    defaultQuestions = [
      {
        type: inputs[0].type,
        name: inputs[0].key,
        message: inputs[0].question,
        validate: amplify.inputValidation(inputs[0]),
        default: 'ElementalLivestream',
      },
      {
        type: inputs[1].type,
        name: inputs[1].key,
        message: inputs[1].question,
        validate: amplify.inputValidation(inputs[1]),
        default: '1',
      },
      {
        type: inputs[2].type,
        name: inputs[2].key,
        message: inputs[2].question,
        validate: amplify.inputValidation(inputs[2]),
        default: '1',
      },
      {
        type: inputs[3].type,
        name: inputs[3].key,
        message: inputs[3].question,
        validate: amplify.inputValidation(inputs[2]),
        default: '3',
      }
    ];
  }

  const mediaLiveQustions = [
      {
        type: inputs[4].type,
        name: inputs[4].key,
        message: inputs[4].question,
        validate: amplify.inputValidation(inputs[4]),
        default: '0.0.0.0/0',
      },
      {
        type: inputs[5].type,
        name: inputs[5].key,
        message: inputs[5].question,
        choices: inputs[5].options,
        default: 'RTP_PUSH',
      },
      {
        type: inputs[6].type,
        name: inputs[6].key,
        message: inputs[6].question,
        choices: inputs[6].options,
        default: 'FULL',
      },
      {
        type: inputs[7].type,
        name: inputs[7].key,
        message: inputs[7].question,
        choices: inputs[7].options,
        default: 'YES',
      }
  ];

  const mediaPackageQuestions = [
    {
      type: inputs[8].type,
      name: inputs[8].key,
      message: inputs[8].question,
      choices: inputs[8].options,
      default: 'HLS,DASH',
    },
    {
        type: inputs[9].type,
        name: inputs[9].key,
        message: inputs[9].question,
        validate: amplify.inputValidation(inputs[9]),
        default: '86400',
    }
  ];

  const mediaStoreQuestions = [
    {
      type: inputs[10].type,
      name: inputs[10].key,
      message: inputs[10].question,
      choices: inputs[10].options,
      default: 'YES',
    }
  ];

  const cloudFrontEnable = [
    {
      type: inputs[11].type,
      name: inputs[11].key,
      message: inputs[11].question,
      choices: inputs[11].options,
      default: 'YES',
    }
  ];

  const cloudFrontQuestions = [
    {
      type: inputs[12].type,
      name: inputs[12].key,
      message: inputs[12].question,
      choices: inputs[12].options,
      default: 'PriceClass_100',
    },
    {
        type: inputs[13].type,
        name: inputs[13].key,
        message: inputs[13].question,
        validate: amplify.inputValidation(inputs[13]),
        default: '',
    },
    {
        type: inputs[14].type,
        name: inputs[14].key,
        message: inputs[14].question,
        validate: amplify.inputValidation(inputs[14]),
        default: 'cf_logs/',
    }
  ]

  answers = await inquirer.prompt(defaultQuestions);
  answers.bucket = context.amplify.getProjectMeta().providers.awscloudformation.DeploymentBucketName;
  if (resourceName){
    answers.resourceName = resourceName;
  }
  mediaLiveAnswers = await inquirer.prompt(mediaLiveQustions);
  mediaPackageAnswers = await inquirer.prompt(mediaPackageQuestions);
  mediaStoreAnswers = await inquirer.prompt(mediaStoreQuestions);
  let cloudfrontenable = await inquirer.prompt(cloudFrontEnable);
  if (cloudfrontenable.enableDistrubtion == 'YES'){
    cloudFrontAnswers = await inquirer.prompt(cloudFrontQuestions);
  }
  cloudFrontAnswers.enableDistrubtion = cloudfrontenable.enableDistrubtion;

  props.shared = answers;
  props.mediaLive = mediaLiveAnswers;
  props.mediaPackage = mediaPackageAnswers;
  props.mediaStore = mediaStoreAnswers;
  props.cloudFront = cloudFrontAnswers;

  return props;
}