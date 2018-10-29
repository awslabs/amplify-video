const inquirer = require('inquirer');
const fs = require('fs-extra');


module.exports = context => {
  context.printMyInfo = async () => {
    await addLivestream(context);
  }
}


async function addLivestream(context){
  let options = {
    service: 'Elemental',
    providerPlugin: 'awscloudformation'
  };
  const result = await serviceQuestions(context);
  copyFilesOver(context, options, result);
}

function copyFilesOver(context, options, props){
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = __dirname;

  const copyJobs = [
    {
        dir: pluginDir,
        template: `cloudformation-templates/live-workflow.json.ejs`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/${props.shared.resourceName}-live-workflow-template.json`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/lambda.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/lambda.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/cloudfront-distribution.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/cloudfront-distribution.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/medialive-channel.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/medialive-channel.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/medialive-iam.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/medialive-iam.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/medialive.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/medialive.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/mediapackage-channel.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/mediapackage-channel.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/mediapackage-iam.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/mediapackage-iam.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/mediapackage.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/mediapackage.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/mediastore-container.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/mediastore-container.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/mediastore-iam.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/mediastore-iam.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/mediastore.template`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/mediastore.template`,
    },
    {
        dir: pluginDir,
        template: `cloudformation-templates/psdemo-js-live-workflow_v0.3.0.zip`,
        target: `${targetDir}/livestream/${props.shared.resourceName}/src/psdemo-js-live-workflow_v0.3.0.zip`,
    }
  ];

  context.amplify.copyBatch(context, copyJobs, props);
  context.amplify.updateamplifyMetaAfterResourceAdd(
    "Elemental",
    props.shared.resourceName,
    options,
  );
}

async function serviceQuestions(context){
  const { amplify } = context;
  let answers;
  let mediaLiveAnswers;
  let mediaStoreAnswers;
  let mediaPackageAnswers;
  let cloudFrontAnswers = {};
  let props = {};
  
  serviceMetadata = JSON.parse(fs.readFileSync(`${__dirname}/questions.json`))['Elemental'];

  const { inputs } = serviceMetadata;

  const defaultQuestions = [
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