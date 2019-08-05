const AWS = require('aws-sdk');
const s3 = new AWS.S3({});


exports.handler = function(event, context, callback){


    let config = event.ResourceProperties;

    console.log(config);

    let responseData = {};

    switch(event.RequestType){
        case 'Create':
            createNotifications(config);
            break;
        case 'Delete':
            deleteNotifications(config);
            break;
        default:
            console.log("No changes")
    }

    let response = sendResponse(event, context, 'SUCCESS', responseData);
    console.log('CFN STATUS:: ', response);
}

function sendResponse(event, context, responseStatus, responseData) {
 
    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
        PhysicalResourceId: context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData
    });
 
    console.log("RESPONSE BODY:\n", responseBody);
 
    var https = require("https");
    var url = require("url");
 
    var parsedUrl = url.parse(event.ResponseURL);
    var options = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.path,
        method: "PUT",
        headers: {
            "content-type": "",
            "content-length": responseBody.length
        }
    };
 
    console.log("SENDING RESPONSE...\n");
 
    var request = https.request(options, function(response) {
        console.log("STATUS: " + response.statusCode);
        console.log("HEADERS: " + JSON.stringify(response.headers));
        // Tell AWS Lambda that the function execution is done  
        context.done();
    });
 
    request.on("error", function(error) {
        console.log("sendResponse Error:" + error);
        // Tell AWS Lambda that the function execution is done  
        context.done();
    });
  
    // write data to request body
    request.write(responseBody);
    request.end();
}

function createNotifications(config){
    
    let params = {
        Bucket: config.BucketName,
        NotificationConfiguration: {
            LambdaFunctionConfigurations:[
                {
                    Events: ['s3:ObjectCreated:*'],
                    LambdaFunctionArn: config.IngestArn,
                    Filter: {
                        Key: {
                            FilterRules: [{
                                Name: 'suffix',
                                Value: '.mpg'
                            }]
                        }
                    }
                },
                {
                    Events: ['s3:ObjectCreated:*'],
                    LambdaFunctionArn: config.IngestArn,
                    Filter: {
                        Key: {
                            FilterRules: [{
                                Name: 'suffix',
                                Value: '.mp4'
                            }]
                        }
                    }
                },
                {
                    Events: ['s3:ObjectCreated:*'],
                    LambdaFunctionArn: config.IngestArn,
                    Filter: {
                        Key: {
                            FilterRules: [{
                                Name: 'suffix',
                                Value: '.m2ts'
                            }]
                        }
                    }
                },
                {
                    Events: ['s3:ObjectCreated:*'],
                    LambdaFunctionArn: config.IngestArn,
                    Filter: {
                        Key: {
                            FilterRules: [{
                                Name: 'suffix',
                                Value: '.mov'
                            }]
                        }
                    }
                },
            ]
        }
    }

    console.log(params);

    s3.putBucketNotificationConfiguration(params, function(err, data){
        if (err) console.log(err, err.stack);
        else     console.log(data);
    });
}

function deleteNotifications(config){
    //Do nothing for now
}