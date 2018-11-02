const inquirer = require('inquirer');
const chalk = require('chalk');

module.exports = context => {
  context.getInfo = async () => {
    let options = {
      service: 'Elemental',
      providerPlugin: 'awscloudformation'
    };
    await getLiveStreamInfo(context, options)
  }
}


async function setupAWS(context, options){
  const { amplify } = context;
  const projectConfig = amplify.getProjectConfig();
  const provider = require(projectConfig.providers[options.providerPlugin]);
  const aws = await provider.getConfiguredAWSClient(context);

  console.log(chalk.bold('Getting info ...'));

  return aws;
}


async function getLiveStreamInfo(context, options){

  let project;
  const chooseProject = [
    {
      type: 'list',
      name: 'resourceName',
      message: 'Choose what project you want to get info for?',
      choices: Object.keys(context.amplify.getProjectMeta().Elemental),
      default: Object.keys(context.amplify.getProjectMeta().Elemental)[0],
    }
  ];

  project = await inquirer.prompt(chooseProject);

  const aws = await setupAWS(context, options);
  const mediaLive = await getMediaLive(aws, project.resourceName);
  const mediaPackage = await getMediaPackage(aws, project.resourceName);
  const mediaStore = await getMediaStore(aws, project.resourceName);
  const cloudFront = await getCloudFront(aws, project.resourceName);

  console.log(mediaLive);
  console.log(mediaPackage);
  console.log(mediaStore);
  console.log(cloudFront);
}

async function getMediaLive(aws, channelName){
  try {
    const mediaLiveClient = new aws.MediaLive();
    const { Channels } = await mediaLiveClient.listChannels({
        MaxResults: 20,
    }).promise();
    const result = Channels.filter(x => x.Name === channelName);
    if(result.length > 1){
      console.log(chalk`{bgYellowBright.bold WARNING:} {bold More than one channel with the name ${channelName} was found. Using first result}`);
    } else if (result.length == 0) {
      console.error(chalk`{bgRedBright.bold Error:} {bold Could not find ${channelName}. Make sure you deployed your live stream.}`);
      return;
    }
    return result[0];
  } catch (e){
    console.error(e);
    return undefined;
  }
}

async function getMediaPackage(aws, channelId){
  try {
    const mediaPackageClient = new aws.MediaPackage();
    const channelInfo = await mediaPackageClient.describeChannel({
      Id: channelId,
    }).promise();
    return channelInfo;
  } catch (e){
    console.error(e);
    return undefined;
  }
}

async function getMediaStore(aws, channelId){
  try {
    const mediaStoreClient = new aws.MediaStore();
    const containerInfo = await mediaStoreClient.describeContainer({
      ContainerName: channelId,
    }).promise();
    return containerInfo;
  } catch (e){
    console.error(e);
    return undefined;
  }
}

async function getCloudFront(aws, channelId){
  try {
    const cloudFrontClient = new aws.CloudFront();
    const cloudFrontInfo = await cloudFrontClient.listDistributions({
      MaxItems: '20',
    }).promise();
  
    const result = cloudFrontInfo.DistributionList.Items.filter(x => x.Comment.includes(channelId));
    if(result.length > 1){
      console.log(chalk`{bgYellowBright.bold WARNING:} {bold More than one channel with the name ${channelName} was found. Using first result}`);
    } else if (result.length == 0) {
      console.error(chalk`{bgRedBright.bold Error:} {bold Could not find ${channelName}. Make sure you deployed your live stream.}`);
      return;
    }
    return result;
  } catch (e){
    console.error(e);
    return undefined;
  }
}