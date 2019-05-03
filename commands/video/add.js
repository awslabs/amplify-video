const inquirer = require('inquirer');
const extensions = require('./supportedExtensions.json');

module.exports = {
  name: 'add',
  run: async (context) => {
    const chooseExtension = [
      {
        type: extensions.type,
        name: extensions.key,
        message: extensions.question,
        choices: extensions.options,
        default: extensions.options[0].key,
      },
    ];
    const chooseExtensionChoice = await inquirer.prompt(chooseExtension);
    if (chooseExtensionChoice.extension === 'vod'){
      //console.log('In Progress.')
      context.createVod();
    } else if (chooseExtensionChoice.extension === 'livestream'){
      context.createLiveStream();
    } else {
      console.log('There was an error. Extension not found')
    }
  },
};
