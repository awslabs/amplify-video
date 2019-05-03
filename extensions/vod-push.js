const inquirer = require('inquirer');
const question = require('./vod-questions.json')
const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const chalk = require('chalk');
const sha1 = require('sha1');

module.exports = (context) => {
    context.createVod = async () => {
      await addVod(context);
    };
};


async function addVod(context) {
    const options = {
        service: 'video',
        providerPlugin: 'awscloudformation',
    };

    const result = await serviceQuestions(context);

    console.log(result);
}

async function serviceQuestions(context){
    const { amplify } = context;
    let props = {};
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
    props.name = nameDict.name;

    const profileQuestion = [
        {
            type: inputs[1].type,
            name: inputs[1].key,
            message: inputs[1].question,
            validate: amplify.inputValidation(inputs[1]),
            choices: inputs[1].options,
        },
    ];
    const profile = await inquirer.prompt(profileQuestion);
    props.profile = profile.encodingProfile;

    if (profile.encodingProfile === 'advance'){
        const transcodeTypes = [
            {
                type: inputs[2].type,
                name: inputs[2].key,
                message: inputs[2].question,
                validate: amplify.inputValidation(inputs[2]),
                choices: inputs[2].options,
            },
        ];

        const inquirerTypes = await inquirer.prompt(transcodeTypes);
        props.types = inquirerTypes.type;
        await asyncForEach(inquirerTypes.type, async (element) => {
            const transcodeQuality = [
                {
                    type: inputs[3].type,
                    name: inputs[3].key,
                    message: inputs[3].question + ' for ' + element,
                    validate: amplify.inputValidation(inputs[3]),
                    choices: inputs[3].options,
                },
            ];
            let inquirerQuality = await inquirer.prompt(transcodeQuality);
            props[element] = inquirerQuality.quality;
        });
    }

    return props;
}


async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
}