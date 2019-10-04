const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const question = require('../../vod-questions.json');
const { getAWSConfig } = require('../utils/get-aws');

const DEBUG = true;

module.exports = {
  serviceQuestions,
};

async function serviceQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
  const provider = getAWSConfig(context, options);
  const aws = await provider.getConfiguredAWSClient(context);
  const projectMeta = context.amplify.getProjectMeta();
  const defaultLocation = path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
  const defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  const props = {};
  let nameDict = {};

  const { inputs } = question.video;
  const nameProject = [
    {
      type: inputs[0].type,
      name: inputs[0].key,
      message: inputs[0].question,
      validate: amplify.inputValidation(inputs[0]),
      default: amplify.getProjectDetails().projectConfig.projectName,
    }];

  if (resourceName) {
    nameDict.resourceName = resourceName;
  } else {
    nameDict = await inquirer.prompt(nameProject);
  }

  props.shared = nameDict;
  props.shared.bucket = projectMeta.providers.awscloudformation.DeploymentBucketName;

  let jobTemplate = {};
  props.template = {};
  while (!('JobTemplate' in jobTemplate)) {
    const templateQuestion = [
      {
        type: inputs[1].type,
        name: inputs[1].key,
        message: inputs[1].question,
        validate: amplify.inputValidation(inputs[1]),
        choices: inputs[1].options,
      },
    ];
    const template = await inquirer.prompt(templateQuestion);

    if (template.encodingTemplate === 'advanced') {
      const encodingTemplateName = [
        {
          type: inputs[2].type,
          name: inputs[2].key,
          message: inputs[2].question,
          validate: amplify.inputValidation(inputs[2]),
        },
      ];
      const advTemplate = await inquirer.prompt(encodingTemplateName);
      props.template.name = advTemplate.encodingTemplate;
    } else {
      props.template.name = template.encodingTemplate;
    }
    const params = {
      Name: props.template.name,
    };
    try {
      let mcClient = new aws.MediaConvert();

      const endpoints = await mcClient.describeEndpoints().promise();
      aws.config.mediaconvert = { endpoint: endpoints.Endpoints[0].Url };
      // Override so config applies
      mcClient = new aws.MediaConvert();
      jobTemplate = await mcClient.getJobTemplate(params).promise();
    } catch (e) {
      console.log(chalk.red(e.message));
      if (DEBUG) {
        break;
      }
    }
  }

  // prompt for cdn
  props.contentDeliveryNetwork = {};
  const cdnEnable = [
    {
      type: inputs[3].type,
      name: inputs[3].key,
      message: inputs[3].question,
      validate: amplify.inputValidation(inputs[3]),
      default: defaults.contentDeliveryNetwork[inputs[3].key],
    }];

  const cdnResponse = await inquirer.prompt(cdnEnable);

  if (!DEBUG) {
    props.template.arn = jobTemplate.JobTemplate.Arn;
  }

  props.contentDeliveryNetwork.enableDistribution = cdnResponse.enableCDN;

  const cmsEnable = [
    {
      type: inputs[4].type,
      name: inputs[4].key,
      message: inputs[4].question,
      validate: amplify.inputValidation(inputs[4]),
      default: defaults.contentManagementSystem[inputs[4].key],
    }];

  const cmsResponse = await inquirer.prompt(cmsEnable);

  if (cmsResponse.enableCMS) {
    let apiName = getAPIName(context);
    if (apiName === '') {
      context.print.warning('Video On Demand only supports GraphQL right now.');
      context.print.warning('If you want to only use API for CMS then choose the default ToDo and don\'t edit it until later.');
      const apiPlugin = amplify.getPluginInstance(context, 'api');
      context.input.command = 'add';
      await apiPlugin.executeAmplifyCommand(context);
      apiName = getAPIName(context);
    } else {
      context.print.info(`Using ${apiName} to manage API`);
    }

    await createCMS(context, resourceName, apiName);
  }

  await inquirer.prompt(cmsEnable);

  return props;
}

async function createCMS(context, resourceName, apiName) {
  const { inputs } = question.video;
  const cmsEdit = [
    {
      type: inputs[5].type,
      name: inputs[5].key,
      message: inputs[5].question,
      default: true,
    },
    {
      type: inputs[6].type,
      name: inputs[6].key,
      message: inputs[6].question,
      default: true,
    }];
  const backEndDir = context.amplify.pathManager.getBackendDirPath();
  const resourceDir = path.normalize(path.join(backEndDir, 'api', apiName));
  let authConfig = {};
  const amplifyMeta = context.amplify.getProjectMeta();
  if ('api' in amplifyMeta && Object.keys(amplifyMeta.api).length !== 0) {
    Object.values(amplifyMeta.api).forEach((project) => {
      if ('output' in project) {
        authConfig = project.output.authConfig;
      }
    });
  }
  const parameters = JSON.parse(fs.readFileSync(`${resourceDir}/parameters.json`));
  const cmsEditResponse = await inquirer.prompt(cmsEdit);
  const editSchemaChoice = cmsEditResponse.editAPI;

  await writeNewModel(context, resourceDir, cmsEditResponse.subscribeField);


  if (editSchemaChoice) {
    await context.amplify.openEditor(context, `${resourceDir}/schema.graphql`).then(async () => {
      let notCompiled = true;
      while (notCompiled) {
        notCompiled = await compileSchema(context, resourceDir, parameters, authConfig);
      }
    });
  } else {
    await compileSchema(context, resourceDir, parameters, authConfig);
  }
}

async function compileSchema(context, resourceDir, parameters, authConfig) {
  try {
    await context.amplify.executeProviderUtils(
      context,
      'awscloudformation',
      'compileSchema',
      { resourceDir, parameters, authConfig },
    );
    return false;
  } catch (e) {
    context.print.error('Failed compiling GraphQL schema:');
    context.print.info(e.message);
    const continueQuestion = {
      type: 'input',
      name: 'pressKey',
      message: `Correct the errors in schema.graphql and press Enter to re-compile.\n\nPath to schema.graphql:\n${resourceDir}/schema.graphql`,
    };
    await inquirer.prompt(continueQuestion);
    return true;
  }
}

async function writeNewModel(context, resourceDir, subscription) {
  const appendSchema = await fs.readFileSync(`${__dirname}/../default-values/schema.graphql`);
  console.log(appendSchema);

  await fs.appendFileSync(`${resourceDir}/schema.graphql`, appendSchema);

  return subscription;
}

function getAPIName(context) {
  const { amplifyMeta } = context.amplify.getProjectDetails();
  let apiName = '';

  if (amplifyMeta.api) {
    const categoryResources = amplifyMeta.api;
    Object.keys(categoryResources).forEach((resource) => {
      if (categoryResources[resource].service === 'AppSync') {
        apiName = resource;
      }
    });
  }
  return apiName;
}
