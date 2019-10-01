const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const question = require('../../vod-questions.json');
const { getAWSConfig } = require('../utils/get-aws');

module.exports = {
  serviceQuestions,
};

async function serviceQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
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

  const provider = getAWSConfig(context, options);
  const aws = await provider.getConfiguredAWSClient(context);

  let mcClient = new aws.MediaConvert();

  const endpoints = await mcClient.describeEndpoints().promise();
  aws.config.mediaconvert = { endpoint: endpoints.Endpoints[0].Url };
  // Override so config applies
  mcClient = new aws.MediaConvert();
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
      jobTemplate = await mcClient.getJobTemplate(params).promise();
    } catch (e) {
      console.log(chalk.red(e.message));
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


  props.template.arn = jobTemplate.JobTemplate.Arn;
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

    //Auth question (paywall or subscription)

    //Do you want to edit the schema that is generated? (Add new meta data).

    //Total overwrite (not default), open editor with changes, add changes no editor

    //Put custom resolvers and lambda function into our deploy.


    /*
    
    type Todo @model {
      id: ID!
      name: String!
      description: String
    }


    @auth(rules: [{allow: groups, groups: ["Admin"], operations:[update] }]

    # Without Auth
    type vodasset @model @auth(rules: [{allow: public, operations:[query, subscriptions]},{allow: groups, groups: ["Admin"], operations:[mutations]}]){
      id:ID!
      title:String!
      description:String!
      length:Int

      #Do not edit
      url:String!
    }

    # With Auth

    type vodasset @model{
      id:ID!
      title:String!
      description:String!
      length:Int
      subscription:String!

      #Do not edit
      url:String!
    }


    */

  }

  await inquirer.prompt(cmsEnable);

  return props;
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