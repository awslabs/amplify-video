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
    //props.shared = {};
    //let defaults = {};
    //defaults.shared.resourceName = amplify.getProjectDetails().projectConfig.projectName;
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

    const templateQuestion = [ // ask questions
        {
            type: inputs[1].type,
            name: inputs[1].key,
            message: inputs[1].question,
            validate: amplify.inputValidation(inputs[1]),
            choices: inputs[1].options,
        },
    ];
    const template = await inquirer.prompt(templateQuestion); // display question
    props.template = template.encodingTemplate; // save answers in props

    if (template.encodingTemplate === 'advance'){
        const encodingTemplateName = [
            {
                type: inputs[2].type,
                name: inputs[2].key,
                message: inputs[2].question,
                validate: amplify.inputValidation(inputs[2]),
            },
        ];
    }
    return props;
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}