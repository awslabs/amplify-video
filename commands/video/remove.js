module.exports = {
  name: 'remove',
  run: async (context) => {
    context.amplify.removeResource(context, 'video');
  },
};
