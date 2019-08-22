const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const chalk = require('chalk');
const sha1 = require('sha1');
const {getAWSConfig} = require('./get-aws');

async function pushRootTemplate(context, options, props, type){
    const { amplify } = context;
    const targetDir = amplify.pathManager.getBackendDirPath();
    const pluginDir = path.join(__dirname + '/..');
    var ending = "json"

    if (options.serviceType === 'vod'){
        ending = "yaml"
    }
  
    const copyJobs = [
      {
        dir: pluginDir,
        template: `cloudformation-templates/${options.serviceType}-workflow.${ending}.ejs`,
        target: `${targetDir}/video/${props.shared.resourceName}/${props.shared.resourceName}-${options.serviceType}-workflow-template.${ending}`,
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
  
    const fileuploads = fs.readdirSync(`${pluginDir}/cloudformation-templates/${options.serviceType}-helpers/`);
  
    if (!fs.existsSync(`${targetDir}/video/${props.shared.resourceName}/${options.serviceType}-helpers/`)) {
      fs.mkdirSync(`${targetDir}/video/${props.shared.resourceName}/${options.serviceType}-helpers/`);
    }
  
    fileuploads.forEach((filePath) => {
      if (filePath != 'LambdaFunctions'){
        fs.copyFileSync(`${pluginDir}/cloudformation-templates/${options.serviceType}-helpers/${filePath}`, `${targetDir}/video/${props.shared.resourceName}/${options.serviceType}-helpers/${filePath}`);
      }
    });
  
    fs.writeFileSync(`${targetDir}/video/${props.shared.resourceName}/props.json`, JSON.stringify(props, null, 4));
}

async function copyFilesToS3(context, options, props) {
    const { amplify } = context;
    const targetDir = amplify.pathManager.getBackendDirPath();
    const targetBucket = amplify.getProjectMeta().providers.awscloudformation.DeploymentBucketName;
    const provider = getAWSConfig(context, options);
    const aws = await provider.getConfiguredAWSClient(context);

    const s3Client = new aws.S3();
    const distributionDirPath = `${targetDir}/video/${props.shared.resourceName}/${options.serviceType}-helpers/`;
    const fileuploads = fs.readdirSync(distributionDirPath);

    fileuploads.forEach((filePath) => {
        uploadFile(s3Client, targetBucket, distributionDirPath, filePath, options);
    });
}
  
async function uploadFile(s3Client, hostingBucketName, distributionDirPath, filePath, options) {
    let relativeFilePath = path.relative(distributionDirPath, filePath);

    relativeFilePath = relativeFilePath.replace(/\\/g, '/');

    const fileStream = fs.createReadStream(`${distributionDirPath}/${filePath}`);
    const contentType = mime.lookup(relativeFilePath);
    const uploadParams = {
        Bucket: hostingBucketName,
        Key: `${options.serviceType}-helpers/${filePath}`,
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

async function stageVideo(context, options, props, type){
    await pushRootTemplate(context, options, props, type);
    await copyFilesToS3(context, options, props);
}


module.exports = {
    stageVideo,
    copyFilesToS3,
};


