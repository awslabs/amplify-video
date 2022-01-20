/* eslint-disable */
const AWS = require('aws-sdk');
/* eslint-enable */
const documentClient = new AWS.DynamoDB.DocumentClient();
const ivs = new AWS.IVS();
const environment = process.env.ENV;
const apiGraphQLAPIIdOutput = process.env.GRAPHQLID;
const myTableName = `Channel-${apiGraphQLAPIIdOutput}-${environment}`;

exports.handler = async (event, context, callback) => {
  const eventId = event.arguments.id;
  if (event.identity.claims.username !== event.arguments.id){
    return;
  }
  try {
    const channelInfo = await documentClient.get({
      TableName: myTableName,
      Key: { id: eventId },
    }).promise();
    const channelItem = channelInfo.Item;
    console.log(channelInfo);
    if (channelItem.streamKeyArn) {
      //update key
      var deleteKeyParams = {
        arn: channelItem.streamKeyArn,
      };
      await ivs.deleteStreamKey(deleteKeyParams).promise();
      var createNewKey = {
        channelArn: channelItem.channelArn
      };
      const newKey = await ivs.createStreamKey(createNewKey).promise();
      var updateChannelParams = {
        TableName: myTableName,
        Key: { id: eventId },
        UpdateExpression : 'set #a = :streamKey, #b = :streamKeyArn',
        ExpressionAttributeNames: { '#a' : 'streamKey',  '#b' : 'streamKeyArn' },
        ExpressionAttributeValues : { ':streamKey': newKey.streamKey.value, ':streamKeyArn': newKey.streamKey.arn},
      };
      await documentClient.update(updateChannelParams).promise();
      channelItem.streamKey = newKey.streamKey.value;
      channelItem.streamKeyArn = newKey.streamKey.arn;
      callback(null, channelItem);
    } else {
      //create key
      var ivsParams = {
        authorized: false,
        latencyMode: 'LOW',
        name: channelItem.id,
        type: 'STANDARD',
      };
      const newChannel = await ivs.createChannel(ivsParams).promise();
      var updateNewChannelParams = {
        TableName: myTableName,
        Key: { id: eventId },
        UpdateExpression : 'set #a = :streamKey, #b = :channelArn, #c = :streamURL, #d = :streamKeyArn, #e = :ingestEndpoint',
        ExpressionAttributeNames: { '#a' : 'streamKey', '#b': 'channelArn', "#c": 'streamURL',  '#d' : 'streamKeyArn', '#e': 'ingestEndpoint' },
        ExpressionAttributeValues : { ':channelArn' : newChannel.channel.arn, ':streamURL': newChannel.channel.playbackUrl, 
                                      ':streamKey': newChannel.streamKey.value, ':streamKeyArn': newChannel.streamKey.arn,
                                      ':ingestEndpoint': newChannel.channel.ingestEndpoint,
        },
      };
      await documentClient.update(updateNewChannelParams).promise();
      channelItem.streamKey = newChannel.streamKey.value;
      channelItem.streamKeyArn = newChannel.streamKey.arn;
      channelItem.channelArn = newChannel.channel.arn;
      channelItem.streamURL = newChannel.channel.playbackUrl;
      channelItem.ingestEndpoint = newChannel.channel.ingestEndpoint;
      callback(null, channelItem);
    }
  } catch (e) {
    console.log(e);
  }
};
