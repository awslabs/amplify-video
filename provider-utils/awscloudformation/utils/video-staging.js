const fs = require('fs-extra');
const childProcess = require('child_process');
const archiver = require('archiver');
const path = require('path');
const mime = require('mime-types');
const chalk = require('chalk');
const ora = require('ora');
const ejs = require('ejs');
const YAML = require('yaml');
const { getAWSConfig } = require('./get-aws');

const spinner = ora('Copying video resources. This may take a few minutes...');


async function buildTemplates(context, props) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const { serviceType } = amplifyMeta.video[props.shared.resourceName];
  context.print.info('Building template files');
  build(context, props.shared.resourceName, serviceType, props);
}

async function pushTemplates(context) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const pushProjects = [];
  spinner.start();
  if ('video' in amplifyMeta) {
    Object.keys(amplifyMeta.video).forEach((resourceName) => {
      const { serviceType } = amplifyMeta.video[resourceName];
      build(context, resourceName, serviceType);
      const options = amplifyMeta.video[resourceName];
      pushProjects.push(
        copyFilesToS3(context, options, resourceName, serviceType),
      );
      pushProjects.push(
        copyParentTemplate(context, resourceName, serviceType),
      );
    });
  }

  await Promise.all(pushProjects);
  spinner.succeed('All resources copied.');
}

function build(context, resourceName, projectType, props) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  if (!props) {
    props = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/props.json`));
  }
  if (projectType === 'video-on-demand') {
    props = getVODEnvVars(context, props, resourceName);
  } else if (projectType === 'livestream') {
    props = getLivestreamEnvVars(context, props);
  }
  syncHelperCF(context, props, projectType);
  buildCustomLambda(context, props, projectType);
}

function getVODEnvVars(context, props, resourceName) {
  const { amplify } = context;
  const currentEnvInfo = amplify.getEnvInfo().envName;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const amplifyMeta = amplify.getProjectMeta();
  const projectBucket = amplifyMeta.providers.awscloudformation.DeploymentBucketName;
  let amplifyProjectDetails = amplify.getProjectDetails();

  if (!((((amplifyProjectDetails.teamProviderInfo[currentEnvInfo].categories
    || {}).video
    || {})[resourceName]
    || {}).s3UUID)) {
    let uuid;
    if (props.shared.bucketInput) {
      // Migrate to env setup
      uuid = props.shared.bucketInput.split('-').pop();
    } else {
      uuid = Math.random().toString(36).substring(2, 8)
        + Math.random().toString(36).substring(2, 8);
    }
    amplify.saveEnvResourceParameters(context, 'video', resourceName, { s3UUID: uuid });
    amplifyProjectDetails = amplify.getProjectDetails();
  }

  // Migration from old props to new props.
  // (Removing bucket and bucket input/output to be stored in env)
  if (props.shared.bucket) {
    delete props.shared.bucket;
    delete props.shared.bucketInput;
    delete props.shared.bucketOutput;
    fs.writeFileSync(`${targetDir}/video/${resourceName}/props.json`, JSON.stringify(props, null, 4));
  }
  const envVars = amplifyProjectDetails.teamProviderInfo[currentEnvInfo]
    .categories.video[resourceName];

  // Merge props with env variables
  props.env = {
    bucket: projectBucket,
    bucketInput: `${resourceName.toLowerCase()}-${currentEnvInfo}-input-${envVars.s3UUID}`.slice(0, 63),
    bucketOutput: `${resourceName.toLowerCase()}-${currentEnvInfo}-output-${envVars.s3UUID}`.slice(0, 63),
  };

  return props;
}

function getLivestreamEnvVars(context, props) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const projectBucket = amplifyMeta.providers.awscloudformation.DeploymentBucketName;
  props.env = {
    bucket: projectBucket,
  };
  return props;
}

async function copyParentTemplate(context, resourceName, serviceType) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);
  const { cfnFilename } = JSON.parse(fs.readFileSync(`${pluginDir}/../supported-services.json`))[serviceType];
  const newCfnName = cfnFilename.split('.')[0];
  let props = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/props.json`));

  if (serviceType === 'video-on-demand') {
    props = getVODEnvVars(context, props, resourceName);
  } else if (serviceType === 'livestream') {
    props = getLivestreamEnvVars(context, props);
  }

  const copyJobs = [
    {
      dir: pluginDir,
      template: `cloudformation-templates/${cfnFilename}`,
      target: `${targetDir}/video/${props.shared.resourceName}/build/${props.shared.resourceName}-${newCfnName}.template`,
    },
  ];

  await context.amplify.copyBatch(context, copyJobs, props, true);
}

function buildCustomLambda(context, props, projectType) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);
  const serviceMetadata = JSON.parse(fs.readFileSync(`${pluginDir}/../supported-services.json`))[projectType];
  const customDir = `${targetDir}/video/${props.shared.resourceName}/custom/${serviceMetadata.stackFolder}/LambdaFunctions`;

  if (fs.existsSync(customDir)) {
    const lambdas = fs.readdirSync(customDir);
    lambdas.forEach((lambda) => {
      if (fs.existsSync(`${customDir}/${lambda}/packages.json`)) {
        handleNodeInstall(`${customDir}/${lambda}`);
      }
    });
  }
}

function syncHelperCF(context, props, projectType) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);
  const serviceMetadata = JSON.parse(fs.readFileSync(`${pluginDir}/../supported-services.json`))[projectType];

  if (!fs.existsSync(`${targetDir}/video/${props.shared.resourceName}/build/${serviceMetadata.stackFolder}/`)) {
    fs.mkdirSync(`${targetDir}/video/${props.shared.resourceName}/build/${serviceMetadata.stackFolder}/`, { recursive: true });
  }

  const filterForEJS = (src, dest) => {
    const cleanSrc = src.replace(pluginDir, '');
    if (cleanSrc.includes('.ejs')) {
      handleEJS(props, src, dest, targetDir, true);
      return false;
    }
    if (cleanSrc.includes('node_modules/') || cleanSrc.includes('package-lock.json')) {
      return false;
    }
    if (cleanSrc.includes('package.json')) {
      const packageSrc = path.join(src, '../');
      const packageDest = path.join(dest, '../');
      fs.copySync(src, dest);
      fs.copySync(`${packageSrc}/package-lock.json`, `${packageDest}/package-lock.json`);
      handleNodeInstall(packageDest);
      return false;
    }
    return true;
  };

  fs.copySync(`${pluginDir}/cloudformation-templates/${serviceMetadata.stackFolder}/`, `${targetDir}/video/${props.shared.resourceName}/build/${serviceMetadata.stackFolder}/`, { filter: filterForEJS });
}


function handleEJS(props, src, dest, targetDir) {
  /*
  Special case for selecting the template. Don't want to polute the props
  var with a massive template. Template name will be stored and will pull
  info from `${targetDir}/video/${props.shared.resourceName}/mediaconvert-job-temp.json`
  */
  if (src.includes('CreateJobTemplate.template.ejs')) {
    const ejsFormated = fs.readFileSync(src, { encoding: 'utf-8' });
    const jobTemplate = JSON.parse(fs.readFileSync(`${targetDir}/video/${props.shared.resourceName}/mediaconvert-job-temp.json`));
    jobTemplate.SettingsJson = jobTemplate.Settings;
    jobTemplate.Name = {
      'Fn::If': [
        'HasEnvironmentParameter',
        {
          'Fn::Join': [
            '-',
            [
              jobTemplate.Name,
              {
                Ref: 'pProjectName',
              },
              {
                Ref: 'env',
              },
            ],
          ],
        },
        {
          Ref: 'pProjectName',
        },
      ],
    };
    delete jobTemplate.Settings;
    const template = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'Auto generated by Amplify Video',
      Parameters: {
        env: {
          Type: 'String',
          Description: 'The environment name. e.g. Dev, Test, or Production.',
          Default: 'NONE',
        },
        pProjectName: {
          Type: 'String',
          Description: 'Project name for the template',
          Default: 'VodTemplate',
        },
      },
      Resources: {
        JobTemplate: {
          Type: 'AWS::MediaConvert::JobTemplate',
          Properties: jobTemplate,
        },
      },
      Conditions: {
        HasEnvironmentParameter: {
          'Fn::Not': [
            {
              'Fn::Equals': [
                {
                  Ref: 'env',
                },
                'NONE',
              ],
            },
          ],
        },
      },
      Outputs: {
        oJobArn: {
          Value: {
            'Fn::GetAtt':
              ['JobTemplate', 'Arn'],
          },
          Description: 'Job Arn',
        },
      },
    };
    const templateProps = { yamlTemplate: YAML.stringify(template) };
    const ejsOutput = ejs.render(ejsFormated, { templateProps });
    const newDest = dest.replace('.ejs', '');
    fs.writeFileSync(newDest, ejsOutput);
    return false;
  }

  const ejsFormated = fs.readFileSync(src, { encoding: 'utf-8' });
  const ejsOutput = ejs.render(ejsFormated, { props });
  const newDest = dest.replace('.ejs', '');
  fs.writeFileSync(newDest, ejsOutput);
  return false;
}

function handleNodeInstall(packageDest) {
  const isWindows = /^win/.test(process.platform);
  const npm = isWindows ? 'npm.cmd' : 'npm';
  const args = ['install'];

  const childProcessResult = childProcess.spawnSync(npm, args, {
    cwd: packageDest,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  if (childProcessResult.status !== 0) {
    throw new Error(childProcessResult.output.join());
  }
}

async function copyFilesToS3(context, options, resourceName, projectType) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const targetBucket = amplify.getProjectMeta().providers.awscloudformation.DeploymentBucketName;
  const provider = getAWSConfig(context, options);
  const aws = await provider.getConfiguredAWSClient(context);
  const pluginDir = path.join(`${__dirname}/../..`);
  const { stackFolder } = JSON.parse(fs.readFileSync(`${pluginDir}/supported-services.json`))[projectType];

  const s3Client = new aws.S3();
  const buildDirPath = `${targetDir}/video/${resourceName}/build/${stackFolder}`;
  const customDirPath = `${targetDir}/video/${resourceName}/custom/${stackFolder}`;
  const fileuploads = fs.readdirSync(buildDirPath);
  const promiseFilesToUpload = [];

  fileuploads.forEach((filePath) => {
    if (filePath === 'LambdaFunctions') {
      const relativeFilePath = `${buildDirPath}/${filePath}`;
      const foldersToZip = fs.readdirSync(relativeFilePath);
      foldersToZip.forEach((lambdaName) => {
        if (lambdaName === '.DS_Store') {
          return;
        }
        if (fs.existsSync(`${customDirPath}/${lambdaName}`)) {
          promiseFilesToUpload.push(
            zipLambdaFunctionsAndPush(context, lambdaName, `${customDirPath}/${filePath}/${lambdaName}`,
              customDirPath, s3Client, targetBucket, stackFolder),
          );
        } else {
          promiseFilesToUpload.push(
            zipLambdaFunctionsAndPush(context, lambdaName, `${buildDirPath}/${filePath}/${lambdaName}`,
              buildDirPath, s3Client, targetBucket, stackFolder),
          );
        }
      });
    } else if (fs.existsSync(`${customDirPath}/${filePath}`)) {
      promiseFilesToUpload.push(
        uploadFile(context, s3Client, targetBucket, customDirPath, filePath, stackFolder),
      );
    } else {
      promiseFilesToUpload.push(
        uploadFile(context, s3Client, targetBucket, buildDirPath, filePath, stackFolder),
      );
    }
  });
  await Promise.all(promiseFilesToUpload);
}

async function zipLambdaFunctionsAndPush(context, lambdaName, lambdaDir, zipDir,
  s3Client, targetBucket, stackFolder) {
  const newFilePath = `${lambdaName}.zip`;
  const zipName = `${zipDir}/${lambdaName}.zip`;
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
  archive.directory(lambdaDir, false);
  await archive.finalize();
  await uploadFile(context, s3Client, targetBucket, zipDir, newFilePath, stackFolder);
}

async function uploadFile(context, s3Client, hostingBucketName, distributionDirPath, filePath,
  stackFolder) {
  let relativeFilePath = path.relative(distributionDirPath, filePath);

  relativeFilePath = relativeFilePath.replace(/\\/g, '/');

  const fileStream = fs.createReadStream(`${distributionDirPath}/${filePath}`);
  const contentType = mime.lookup(relativeFilePath);
  const uploadParams = {
    Bucket: hostingBucketName,
    Key: `${stackFolder}/${filePath}`,
    Body: fileStream,
    ContentType: contentType || 'text/plain',
  };

  s3Client.upload(uploadParams, (err) => {
    if (err) {
      context.print.error(chalk.bold('Failed uploading object to S3. Check your connection and try to running amplify push'));
    }
  });
}

module.exports = {
  buildTemplates,
  pushTemplates,
};
