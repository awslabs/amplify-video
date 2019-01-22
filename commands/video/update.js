const chalk = require('chalk');

module.exports = {
 name: 'update',
 run: async (context) => {
    context.updateLiveStream();
 }
}