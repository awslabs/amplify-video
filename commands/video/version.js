const fs = require('fs');

const serviceMetadata = JSON.parse(fs.readFileSync(`${__dirname}/../../package.json`));
const subcommand = 'version';

module.exports = {
  name: subcommand,
  run: async (context) => {
    context.print.info(`amplify-category-video@${serviceMetadata.version}`);
  },
};
