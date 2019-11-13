const fs = require('fs-extra');
const archiver = require('archiver');
const path = require('path');
const mime = require('mime-types');
const chalk = require('chalk');
const sha1 = require('sha1');
const { getAWSConfig } = require('./get-aws');

async function copyFilesToS3(context, options, resourceName, stackFolder) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const targetBucket = amplify.getProjectMeta().providers.awscloudformation.DeploymentBucketName;
  const provider = getAWSConfig(context, options);
  const aws = await provider.getConfiguredAWSClient(context);

  const s3Client = new aws.S3();
  const distributionDirPath = `${targetDir}/video/${resourceName}/${stackFolder}/`;
  const fileuploads = fs.readdirSync(distributionDirPath);

  fileuploads.forEach((filePath) => {
    if (filePath === 'LambdaFunctions') {
      const relativeFilePath = `${distributionDirPath}/${filePath}`;
      const foldersToZip = fs.readdirSync(relativeFilePath);
      foldersToZip.forEach(async (lambdaName) => {
        if (lambdaName === '.DS_Store') {
          return;
        }
        const newFilePath = `${lambdaName}.zip`;
        const zipName = `${targetDir}/video/${resourceName}/${stackFolder}/${lambdaName}.zip`;
        if (fs.existsSync(zipName)) {
          fs.unlinkSync(zipName);
        }
        const output = fs.createWriteStream(zipName);
        const archive = archiver('zip');
        archive.on('warning', (err) => {
          if (err.code === 'ENOENT') {
            context.print.warning(err);
          } else {
            context.print.error(err);
          }
        });
        archive.on('error', (err) => {
          context.print.error(err);
          throw err;
        });
        archive.pipe(output);
        archive.directory(`${targetDir}/video/${resourceName}/${stackFolder}/${filePath}/${lambdaName}`, false);
        await archive.finalize();
        await uploadFile(s3Client, targetBucket, distributionDirPath, newFilePath, stackFolder);
      });
    } else {
      uploadFile(s3Client, targetBucket, distributionDirPath, filePath, stackFolder);
    }
    
  });
}

async function uploadFile(s3Client, hostingBucketName, distributionDirPath, filePath, stackFolder) {
  let relativeFilePath = path.relative(distributionDirPath, filePath);

  relativeFilePath = relativeFilePath.replace(/\\/g, '/');

  const fileStream = fs.createReadStream(`${distributionDirPath}/${filePath}`);
  const contentType = mime.lookup(relativeFilePath);
  const uploadParams = {
    Bucket: hostingBucketName,
    Key: `${stackFolder}/${filePath}`,
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

async function stageVideo(context, options, props, cfnFilename, stackFolder, type) {
  await pushRootTemplate(context, options, props, cfnFilename, type);
  await syncHelperCF(context, props, stackFolder);
}

async function syncHelperCF(context, props, stackFolder) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);

  if (!fs.existsSync(`${targetDir}/video/${props.shared.resourceName}/${stackFolder}/`)) {
    fs.mkdirSync(`${targetDir}/video/${props.shared.resourceName}/${stackFolder}/`);
  }

  fs.copySync(`${pluginDir}/cloudformation-templates/${stackFolder}/`, `${targetDir}/video/${props.shared.resourceName}/${stackFolder}/`);
}

async function pushRootTemplate(context, options, props, cfnFilename, type) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);
  const newCfnName = cfnFilename.split('.')[0];

  const copyJobs = [
    {
      dir: pluginDir,
      template: `cloudformation-templates/${cfnFilename}`,
      target: `${targetDir}/video/${props.shared.resourceName}/${props.shared.resourceName}-${newCfnName}.template`,
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

  if (props.parameters !== undefined) {
    await fs.writeFileSync(`${targetDir}/video/${props.shared.resourceName}/parameters.json`, JSON.stringify(props.parameters, null, 4));
  }

  await fs.writeFileSync(`${targetDir}/video/${props.shared.resourceName}/props.json`, JSON.stringify(props, null, 4));
}

async function updateWithProps(context, options, props, resourceName, cfnFilename, stackFolder) {
  pushRootTemplate(context, options, props, cfnFilename, 'update');
  syncHelperCF(context, props, stackFolder);
}

async function resetupFiles(context, options, resourceName, stackFolder) {
  const props = {
    shared: {
      resourceName,
    },
  };
  syncHelperCF(context, props, stackFolder);
}

module.exports = {
  stageVideo,
  updateWithProps,
  resetupFiles,
  copyFilesToS3,
};
