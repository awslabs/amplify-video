module.exports = {
    name: 'stop',
    run: async (context) => {
        context.stopStream();
    }
}