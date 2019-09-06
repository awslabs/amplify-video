const subcommand = 'remove';
const category = 'video';

module.exports = {
  name: subcommand,
  run: async (context) => {
    context.amplify.removeResource(context, category);
  },
};
