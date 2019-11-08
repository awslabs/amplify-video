const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const question = require('../../vod-questions.json');
const {getAWSConfig} = require('../utils/get-aws');

module.exports={
    serviceQuestions,
}

async function serviceQuestions(context, options, defaultValuesFilename, resourceName){
    const { amplify } = context;
    const projectMeta = context.amplify.getProjectMeta();
    const defaultLocation = path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
    let defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
    let props = {};
    let nameDict = {};

    let inputs = question.video.inputs;
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

    var mc_client = new aws.MediaConvert();

    const endpoints = await mc_client.describeEndpoints().promise();
    aws.config.mediaconvert = {endpoint : endpoints.Endpoints[0].Url};
    //Override so config applies
    mc_client = new aws.MediaConvert();
    var jobTemplate = {};
    props.template = {};
    while (!("JobTemplate" in jobTemplate)){
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
        
        if (template.encodingTemplate === 'advanced'){
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
        var params = {
            Name: props.template.name
        };
        try {
            jobTemplate = await mc_client.getJobTemplate(params).promise();
        } catch (e){
            console.log(chalk.red(e.message));
        }
    }
    
  //prompt for cdn
  props.contentDeliveryNetwork = {};
  const cdnEnable = [
    {
        type: inputs[3].type,
        name: inputs[3].key,
        message: inputs[3].question,
        validate: amplify.inputValidation(inputs[3]),
        default: defaults.contentDeliveryNetwork[inputs[3].key],
    }];

    let cdnResponse = await inquirer.prompt(cdnEnable)


    props.template.arn = jobTemplate.JobTemplate.Arn
    props.contentDeliveryNetwork.enableDistribution = cdnResponse.enableCDN;
    
    return props;
}