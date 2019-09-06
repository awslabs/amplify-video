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
      return providerController.addResource(context, results.service, options);
    });
  },
  
};
