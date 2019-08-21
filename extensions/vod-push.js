const inquirer = require('inquirer');
const question = require('./vod-questions.json');
const {stageVideo} = require('./helpers/video-staging');

module.exports = (context) => {
    context.createVod = async () => {
      await addVod(context);
    };
};


async function addVod(context) {
    const options = {
        service: 'video',
        serviceType: 'vod',
        providerPlugin: 'awscloudformation',
    };

    const result = await serviceQuestions(context);
    stageVideo(context, options, result, 'add');
}

async function serviceQuestions(context){
    const { amplify } = context;
    let props = {};

    let inputs = question.video.inputs;
    const nameProject = [
    {
        type: inputs[0].type,
        name: inputs[0].key,
        message: inputs[0].question,
        validate: amplify.inputValidation(inputs[0]),
        default: amplify.getProjectDetails().projectConfig.projectName,
    }];

    const nameDict = await inquirer.prompt(nameProject);
    props.shared = nameDict;
    props.shared.bucket = projectMeta.providers.awscloudformation.DeploymentBucketName;

    const provider = getAWSConfig(context, options);
    var mc_client = new provider.MediaConvert();

    const endpoints = await mc_client.describeEndpoints().promise();
    provider.config.mediaconvert = {endpoint : endpoints.Endpoints[0].Url};
    //Override so config applies
    mc_client = new provider.MediaConvert();
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
        
        if (template.encodingTemplate === 'advance'){
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
            Name: props.template
        };
        try {
            jobTemplate = await mc_client.getJobTemplate(params).promise();
        } catch (e){
            console.log(e.message);
        }
    }
    
    props.template.arn = jobTemplate.JobTemplate.Arn
    
    return props;
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}