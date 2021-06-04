const fs = require('fs-extra');
const childProcess = require('child_process');
const archiver = require('archiver');
const path = require('path');
const mime = require('mime-types');
const ora = require('ora');
const ejs = require('ejs');
const YAML = require('yaml');
const { getAWSConfig } = require('./get-aws');

async function buildTemplates(context, props) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const { serviceType } = amplifyMeta.video[props.shared.resourceName];
  const spinner = ora('Building video resources...');
  spinner.start();
  return build(context, props.shared.resourceName, serviceType, props).then(() => {
    spinner.succeed('All resources built.');
  });
}

async function pushTemplates(context) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const buildProjects = [];
  const pushProjects = [];
  const spinner = ora('Copying video resources. This may take a few minutes...');
  spinner.start();
  if ('video' in amplifyMeta) {
    Object.keys(amplifyMeta.video).forEach((resourceName) => {
      const { serviceType } = amplifyMeta.video[resourceName];
      buildProjects.push(
        build(context, resourceName, serviceType).then((props) => {
          const options = amplifyMeta.video[resourceName];
          pushProjects.push(
            copyFilesToS3(context, options, resourceName, serviceType, props),
          );
          pushProjects.push(
            copyParentTemplate(context, serviceType, props),
          );
        }),
      );
    });
  }
  await Promise.all(buildProjects);
  await Promise.all(pushProjects).then(() => {
    spinner.succeed('All resources copied.');
  });
}

async function build(context, resourceName, projectType, props) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const projectDetails = context.amplify.getProjectDetails();

  const newEnvName = projectDetails.localEnvInfo.envName;
  const resourceFilesBaseDir = `${targetDir}/video/${resourceName}/`;
  const resourceFilesList = fs.readdirSync(resourceFilesBaseDir);


  // Check if env-specific props file already exists
  const hasOwnEnvProps = resourceFilesList.includes(`${newEnvName}-props.json`);

  // Check if ANY props file exist for a different env in this project  || returns array
  const hasAnyEnvProps = resourceFilesList.find(fileName => fileName.includes('-props.json'));

  // If this env doesn't have its own props AND there is an existing amplify-video resource
  if (!hasOwnEnvProps && hasAnyEnvProps) {
    // take the first props file you find and copy that!
    const propsFilenameToCopy = resourceFilesList.filter(propsFileName => propsFileName.includes('-props.json'))[0];

    // extract substring for the existing env's name we're going to copy over
    const envNameToReplace = propsFilenameToCopy.substr(0, propsFilenameToCopy.indexOf('-'));

    // read JSON from the existing env's props file
    const existingPropsToMutate = JSON.parse(fs.readFileSync(`${resourceFilesBaseDir}/${propsFilenameToCopy}`));

    const searchAndReplaceProps = () => {
      const newPropsObj = {};
      // eslint-disable-next-line no-restricted-syntax
      for (const [key, value] of Object.entries(existingPropsToMutate.contentDeliveryNetwork)) {
        // look for any string values that contain existing env's name
        if (typeof value === 'string' && value.includes(`${envNameToReplace}`)) {
          // replace with new env name
          const newValue = value.replace(new RegExp(envNameToReplace, 'g'), `${newEnvName}`);
          newPropsObj[key] = newValue;
        } else {
          // copy existing values that do not match replacement conditions aka "generic props"
          newPropsObj[key] = value;
        }
      }
      return newPropsObj;
    };

    // merge new props and existing generic props
    const newPropsToSave = Object.assign(
      existingPropsToMutate, { contentDeliveryNetwork: searchAndReplaceProps() },
    );

    fs.writeFileSync(`${resourceFilesBaseDir}/${newEnvName}-props.json`, JSON.stringify(newPropsToSave, null, 4));
  }

  if (!props) {
    props = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/${projectDetails.localEnvInfo.envName}-props.json`));
  }
  if (projectType === 'video-on-demand') {
    props = getVODEnvVars(context, props, resourceName);
  } else if (projectType === 'livestream') {
    props = getLivestreamEnvVars(context, props);
  }
  await syncHelperCF(context, props, projectType);
  props.hashes = await generateLambdaHashes(context, props, projectType);
  await buildCustomLambda(context, props, projectType);
  return props;
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
    fs.writeFileSync(`${targetDir}/video/${resourceName}/${amplifyProjectDetails.localEnvInfo.envName}-props.json`, JSON.stringify(props, null, 4));
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

async function generateLambdaHashes(context, props, projectType) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);
  const serviceMetadata = JSON.parse(fs.readFileSync(`${pluginDir}/../supported-services.json`))[projectType];
  const customDir = `${targetDir}/video/${props.shared.resourceName}/custom/${serviceMetadata.stackFolder}/LambdaFunctions`;
  const buildDir = `${targetDir}/video/${props.shared.resourceName}/build/${serviceMetadata.stackFolder}/LambdaFunctions`;
  const buildHashes = [];
  const customHashes = [];
  const lambdas = fs.readdirSync(buildDir);
  const hashes = { };
  lambdas.forEach((lambda) => {
    if (lambda === '.DS_Store') {
      return;
    }
    buildHashes.push(
      amplify.hashDir(path.join(buildDir, lambda), ['node_modules']).then((result) => {
        hashes[lambda] = result;
      }),
    );
  });
  await Promise.all(buildHashes);
  if (fs.existsSync(customDir)) {
    const customLambdas = fs.readdirSync(customDir);
    customLambdas.forEach((lambda) => {
      customHashes.push(
        amplify.hashDir(path.join(customDir, lambda), ['node_modules']).then((result) => {
          hashes[lambda] = result;
        }),
      );
    });
    await Promise.all(customHashes);
  }
  return hashes;
}

async function copyParentTemplate(context, serviceType, props) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);
  const { cfnFilename } = JSON.parse(fs.readFileSync(`${pluginDir}/../supported-services.json`))[serviceType];
  const newCfnName = cfnFilename.replace('.ejs', '');

  const copyJobs = [
    {
      dir: pluginDir,
      template: `cloudformation-templates/${cfnFilename}`,
      target: `${targetDir}/video/${props.shared.resourceName}/build/${props.shared.resourceName}-${newCfnName}`,
    },
  ];

  await context.amplify.copyBatch(context, copyJobs, props, true);
}

async function buildCustomLambda(context, props, projectType) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);
  const serviceMetadata = JSON.parse(fs.readFileSync(`${pluginDir}/../supported-services.json`))[projectType];
  const customDir = `${targetDir}/video/${props.shared.resourceName}/custom/${serviceMetadata.stackFolder}/LambdaFunctions`;
  const handleNodePromises = [];
  if (fs.existsSync(customDir)) {
    const lambdas = fs.readdirSync(customDir);
    lambdas.forEach((lambda) => {
      if (fs.existsSync(`${customDir}/${lambda}/packages.json`)) {
        handleNodePromises.push(
          handleNodeInstall(`${customDir}/${lambda}`),
        );
      }
    });
  }
  await Promise.all(handleNodePromises);
}

async function syncHelperCF(context, props, projectType) {
  const { amplify } = context;
  const targetDir = amplify.pathManager.getBackendDirPath();
  const pluginDir = path.join(`${__dirname}/..`);
  const serviceMetadata = JSON.parse(fs.readFileSync(`${pluginDir}/../supported-services.json`))[projectType];
  const nodeInstallsPromise = [];

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
      nodeInstallsPromise.push(
        handleNodeInstall(packageDest),
      );
      return false;
    }
    return true;
  };

  nodeInstallsPromise.push(fs.copy(`${pluginDir}/cloudformation-templates/${serviceMetadata.stackFolder}/`, `${targetDir}/video/${props.shared.resourceName}/build/${serviceMetadata.stackFolder}/`, { filter: filterForEJS }));
  await Promise.all(nodeInstallsPromise);
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

async function handleNodeInstall(packageDest) {
  const isWindows = /^win/.test(process.platform);
  const npm = isWindows ? 'npm.cmd' : 'npm';
  const args = ['install'];

  const childProcessResult = childProcess.spawn(npm, args, {
    cwd: packageDest,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  childProcessResult.on('error', (error) => {
    console.log(error);
  });
  return childProcessResult;
}

async function copyFilesToS3(context, options, resourceName, projectType, props) {
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
        if (fs.existsSync(`${customDirPath}/${filePath}/${lambdaName}`)) {
          promiseFilesToUpload.push(
            zipLambdaFunctionsAndPush(context, lambdaName, `${customDirPath}/${filePath}/${lambdaName}`,
              customDirPath, s3Client, targetBucket, stackFolder, props.hashes[lambdaName]),
          );
        } else {
          promiseFilesToUpload.push(
            zipLambdaFunctionsAndPush(context, lambdaName, `${buildDirPath}/${filePath}/${lambdaName}`,
              buildDirPath, s3Client, targetBucket, stackFolder, props.hashes[lambdaName]),
          );
        }
      });
    } else if (fs.existsSync(`${customDirPath}/${filePath}`) && !filePath.includes('.zip')) {
      promiseFilesToUpload.push(
        uploadFile(context, s3Client, targetBucket, customDirPath, filePath, stackFolder),
      );
    } else if (!filePath.includes('.zip')) {
      promiseFilesToUpload.push(
        uploadFile(context, s3Client, targetBucket, buildDirPath, filePath, stackFolder),
      );
    }
  });
  await Promise.all(promiseFilesToUpload);
}

async function zipLambdaFunctionsAndPush(context, lambdaName, lambdaDir, zipDir,
  s3Client, targetBucket, stackFolder, hash) {
  const newFilePath = `${lambdaName}.zip`;
  const zipName = `${zipDir}/${lambdaName}.zip`;
  let hashName = `${lambdaName}-${hash}.zip`;

  // Ignore livestream for now.
  if (lambdaName === 'psdemo-js-live-workflow_v0.4.0') {
    hashName = newFilePath;
  }
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
  archive.on('end', async () => {
    await uploadFile(context, s3Client, targetBucket, zipDir, newFilePath, stackFolder, hashName);
  });
  archive.on('error', (err) => {
    context.print.error(err);
    throw err;
  });
  archive.pipe(output);
  archive.directory(lambdaDir, false);
  await archive.finalize();
}

async function uploadFile(context, s3Client, hostingBucketName, distributionDirPath, filePath,
  stackFolder, nameOverride) {
  let relativeFilePath = path.relative(distributionDirPath, filePath);

  relativeFilePath = relativeFilePath.replace(/\\/g, '/');
  const fileKey = (nameOverride) ? `${stackFolder}/${nameOverride}` : `${stackFolder}/${filePath}`;

  const fileStream = fs.createReadStream(`${distributionDirPath}/${filePath}`);
  const contentType = mime.lookup(relativeFilePath);
  const uploadParams = {
    Bucket: hostingBucketName,
    Key: fileKey,
    Body: fileStream,
    ContentType: contentType || 'text/plain',
  };
  try {
    await s3Client.upload(uploadParams).promise();
  } catch (error) {
    context.print.error(`Failed pushing to S3 with error: ${error}`);
  }
}

module.exports = {
  buildTemplates,
  pushTemplates,
};
