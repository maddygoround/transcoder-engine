const AWS = require("aws-sdk");
const { join } = require("path");
const { logger } = require("../../logger");
const { writeFile } = require("fs").promises;
const { existsSync, mkdirSync } = require("fs");
/**
 * Donwload Video Assets from s3
 * @param {*} bucket
 * @param {*} template
 */
const downloadAsset = (s3, bucket, path) => {
  try {
    return s3.getObject({ Bucket: bucket, Key: path }).promise();
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * Create directory to proccess video
 * @param {*} dir
 */
const createDirIfNotDitch = (dir) => {
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir);
    }
    return true;
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = async (options) => {
  try {
    createDirIfNotDitch(options.job.id);
    const input = join(options.job.id, process.env.INPUT);

    // const s3 = new AWS.S3({
    //   region: options.region,
    //   accessKeyId: options.key,
    //   secretAccessKey: options.secret,
    // });

    // /**
    //  * downloading video assets from streams
    //  */
    // logger.info(`Downloading video assets`);
    // const downloadAssetsQueue = [
    //   downloadAsset(s3, options.bucket, options.path),
    // ];
    // const response = await Promise.all(downloadAssetsQueue);
    // logger.info(`Video assets downloaded`);

    // /**
    //  * write assets to temp directory
    //  */
    // logger.info(`Writing videos to Output Directory`);
    // const writeAssetsQueue = [writeFile(input, response[0].Body)];
    // await Promise.all(writeAssetsQueue);
    // logger.info(`Videos saved to directory`);

    return {
      [options.type]: {
        agent: options.agent,
        job: options.job,
        input,
      },
    };
  } catch (err) {
    throw err;
  }
};
