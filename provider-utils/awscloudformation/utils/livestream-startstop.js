const ora = require('ora');
const { getAWSConfig } = require('./get-aws');

module.exports = {
  liveStartStop,
};

async function liveStartStop(context, options, resourceId, desiredState) {
  const spinner = ora(`${(desiredState) ? 'Starting' : 'Stopping'} the resource`);
  spinner.start();
  const provider = getAWSConfig(context, options);
  const aws = await provider.getConfiguredAWSClient(context);
  const mediaLive = new aws.MediaLive();

  const mediaLiveParameters = {
    ChannelId: resourceId,
  };
  mediaLive.describeChannel(mediaLiveParameters, (error, channelDetails) => {
    if (error) {
      spinner.fail(error);
      return;
    }
    if (channelDetails.State === 'RUNNING' && !desiredState) {
      mediaLive.stopChannel(mediaLiveParameters, (stopError) => {
        if (stopError) spinner.fail(stopError);
        else spinner.succeed('Stopped stream successfully');
      });
    } else if (channelDetails.State === 'IDLE' && desiredState) {
      mediaLive.startChannel(mediaLiveParameters, (startError) => {
        if (startError) spinner.fail(startError);
        else spinner.succeed('Started stream successfully');
      });
    } else if (channelDetails.State === 'RUNNING' || channelDetails.State === 'IDLE') {
      spinner.fail(`Trying to ${(desiredState) ? ('start') : ('stop')} stream when it already ${(desiredState) ? ('started') : ('stopped')}`);
    } else {
      spinner.fail(`Stream is in ${channelDetails.State} state. Can't change state right now`);
    }
  });
}
