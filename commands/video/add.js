//const inquirer = require('inquirer');
//const extensions = require('./supportedExtensions.json');
const fs = require('fs');
const serviceMetadata = JSON.parse(fs.readFileSync(`${__dirname}/../../provider-utils/supported-services.json`));
const subcommand = 'add';
const category = 'video';

let options;

module.exports = {
  name: subcommand,
  run: async (context) => {
    const {amplify} = context;
    return amplify.serviceSelectionPrompt(context, category, serviceMetadata).then((results) => {
      options = {
        service: category,
        serviceType: results.service,
        providerPlugin: results.providerName,
      };
      const providerController =
          require(`../../provider-utils/${results.providerName}/index`);
      if (!providerController) {
        context.print.error('Provider not configured for this category');
        return;
      }
      return providerController.addResource(context, category, results.service, options);
    });
    /*
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
    */
  },
  
};
