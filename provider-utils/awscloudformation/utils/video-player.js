const chalk = require('chalk');

module.exports = {
  setupPlayer,
};

async function setupPlayer(context, resourceName) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  if ('output' in amplifyMeta.video[resourceName]) {
    // TODO: Remove it
    console.log('Works');
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}
