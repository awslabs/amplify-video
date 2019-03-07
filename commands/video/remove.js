module.exports = {
  name: 'remove',
  run: async (context) => {
    context.removeLiveStream(context);
  },
};
