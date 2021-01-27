function autoAnswer({
  context, answers, key, value,
}) {
  if (context.parameters.options.payload) {
    answers[key] = value;
  } else {
    return true;
  }
}

module.exports = {
  autoAnswer,
};
