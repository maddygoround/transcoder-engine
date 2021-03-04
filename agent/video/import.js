const { download, createDirIfNotDitch } = require("../../utils");
const { join } = require("path");

module.exports = async (options) => {
  createDirIfNotDitch(options.job.id);
  let input = join(options.job.id, process.env.INPUT);
  input = await download(options.url, input);
  return {
    [options.type]: {
      agent: options.agent,
      job: options.job,
      input,
    },
  };
};
