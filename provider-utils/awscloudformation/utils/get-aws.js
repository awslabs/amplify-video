function getAWSConfig(context, options){
    var provider;
    if ( typeof context.amplify.getPluginInstance === "function"){
      provider = context.amplify.getPluginInstance(context, options.providerPlugin);
    } else {
      console.log("Falling back to old version of getting AWS SDK. If you see this error you are running an old version of Amplify. Please update as soon as possible!");
      provider = getPluginInstanceShim(context, options.providerPlugin);
    }

    return provider;
}

/*
Shim for old versions of amplify.
*/
function getPluginInstanceShim(context, pluginName) {
    const { plugins } = context.runtime;
    const pluginObj = plugins.find((plugin) => {
        const nameSplit = plugin.name.split('-');
        return (nameSplit[nameSplit.length - 1] === pluginName);
    });
    if (pluginObj) {
        return require(pluginObj.directory);
    }
}

module.exports = {
    getAWSConfig,
};