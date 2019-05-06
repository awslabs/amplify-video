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
    //console.log(result);
    await pushRootTemplate(context, options, result, 'add');
    await copyFilesToS3(context, options, result);

    //console.log(result);
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

async function pushRootTemplate(context, options, props, type){
    const { amplify } = context;
    const targetDir = amplify.pathManager.getBackendDirPath();
    const pluginDir = __dirname;
  
    const copyJobs = [
      {
        dir: pluginDir,
        template: 'cloudformation-templates/vod-workflow.json.ejs',
        target: `${targetDir}/video/${props.shared.resourceName}/${props.shared.resourceName}-vod-workflow-template.json`,
      },
    ];
  
    options.sha = sha1(JSON.stringify(props));
  
    if (type === 'add') {
      context.amplify.updateamplifyMetaAfterResourceAdd(
        'video',
        props.shared.resourceName,
        options,
      );
    } else if (type === 'update') {
      if (options.sha === context.amplify.getProjectMeta().video[props.shared.resourceName].sha) {
        console.log('Same setting detected. Not updating project.');
        return;
      }
      context.amplify.updateamplifyMetaAfterResourceUpdate(
        'video',
        props.shared.resourceName,
        'sha',
        options.sha,
      );
    }
  
    await context.amplify.copyBatch(context, copyJobs, props);
  
    const fileuploads = fs.readdirSync(`${pluginDir}/cloudformation-templates/vod-helpers/`);
  
    if (!fs.existsSync(`${targetDir}/video/${props.shared.resourceName}/vod-helpers/`)) {
      fs.mkdirSync(`${targetDir}/video/${props.shared.resourceName}/vod-helpers/`);
    }
  
    fileuploads.forEach((filePath) => {
      fs.copyFileSync(`${pluginDir}/cloudformation-templates/vod-helpers/${filePath}`, `${targetDir}/video/${props.shared.resourceName}/vod-helpers/${filePath}`);
    });
  
    fs.writeFileSync(`${targetDir}/video/${props.shared.resourceName}/props.json`, JSON.stringify(props, null, 4));
}

async function copyFilesToS3(context, options, props) {
    const { amplify } = context;
    const targetDir = amplify.pathManager.getBackendDirPath();
    const targetBucket = amplify.getProjectMeta().providers.awscloudformation.DeploymentBucketName;
    const provider = context.amplify.getPluginInstance(context, options.providerPlugin);

    const aws = await provider.getConfiguredAWSClient(context);
    const s3Client = new aws.S3();
    const distributionDirPath = `${targetDir}/video/${props.shared.resourceName}/vod-helpers/`;
    const fileuploads = fs.readdirSync(distributionDirPath);

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
        Key: `vod-helpers/${filePath}`,
        Body: fileStream,
        ContentType: contentType || 'text/plain',
        ACL: 'public-read',
    };

    s3Client.upload(uploadParams, (err) => {
        if (err) {
        console.log(chalk.bold('Failed uploading object to S3. Check your connection and try to run amplify video setup'));
        }
    });
}