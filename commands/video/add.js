const fs = require('fs');

const serviceMetadata = JSON.parse(fs.readFileSync(`${__dirname}/../../provider-utils/supported-services.json`));
const subcommand = 'add';
const category = 'video';

let options;

module.exports = {
  name: subcommand,
  run: async (context) => {
    const { amplify } = context;

    // Headless mode
    if (context.parameters.options.payload) {
      const args = JSON.parse(context.parameters.options.payload);
      options = {
        service: args.service,
        serviceType: args.serviceType,
        providerPlugin: args.providerName,
      };
      const providerController = require(`../../provider-utils/${options.providerPlugin}/index`);
      if (!providerController) {
        context.print.error('Provider not configured for this category');
        return;
      }
      return providerController.addResource(context, options.serviceType, options);
    }

    // Normal mode
    // Hiding livestream as marking as old/unsupported.
    delete serviceMetadata.livestream;
    return amplify.serviceSelectionPrompt(context, category, serviceMetadata).then((results) => {
      options = {
        service: category,
        serviceType: results.service,
        providerPlugin: results.providerName,
      };
      const providerController = require(`../../provider-utils/${results.providerName}/index`);
      if (!providerController) {
        context.print.error('Provider not configured for this category');
        return;
      }
      return providerController.addResource(context, results.service, options);
    });
  },

};
