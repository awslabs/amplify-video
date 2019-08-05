var util = require('util');


exports.handler = function(event, context, callback){

    console.log("Reading options from event:\n", util.inspect(event, {depth: 5}));

}