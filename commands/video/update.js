const chalk = require('chalk');

module.exports = {
 name: 'update',
 run: async (context) => {
    console.log(chalk.bold('This is currently not working!'));
    context.updateLiveStream();
 }
}