const path = require('path');
const fs = require('fs-extra');
const {stageVideo} = require('./utils/video-staging')

let serviceMetadata;

async function addResource(context, category, service, options) {

    serviceMetadata = context.amplify.readJsonFile(`${__dirname}/../supported-services.json`)[service];
    let { cfnFilename, stackFolder } = serviceMetadata;
    const { serviceWalkthroughFilename, defaultValuesFilename } = serviceMetadata;
    const serviceWalkthroughSrc = `${__dirname}/service-walkthroughs/${serviceWalkthroughFilename}`;
    const {serviceQuestions} = require(serviceWalkthroughSrc);
    const result = await serviceQuestions(context, options, defaultValuesFilename);
    await stageVideo(context, options, result, cfnFilename, stackFolder, 'add');

}



module.exports = {
    addResource,
}