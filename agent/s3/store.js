const AWS = require("aws-sdk");
const uuid = require("uuid");
const { join, sep } = require("path");
const { logger } = require("../../logger");
const { getType } = require("mime");
const { writeFile, readFile } = require("fs").promises;
const {
  existsSync,
  readdir,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} = require("fs");
const slasher = require("../../slasher");
/**
 * Get All files Recursively
 * @param {*} dirPath
 * @param {*} arrayOfFiles
 */
const getAllFilesRecursively = (dirPath, arrayOfFiles) => {
  const files = readdirSync(dirPath);

  files.forEach((file) => {
    if (statSync(dirPath + sep + file).isDirectory()) {
      arrayOfFiles = getAllFilesRecursively(join(dirPath, file), arrayOfFiles);
    } else {
      arrayOfFiles.push(join(dirPath, file));
    }
  });

  return arrayOfFiles;
};

/**
 * Get All Files
 * @param {*} dirPath
 */
const getAllFiles = (dirPath) => {
  return getAllFilesRecursively(dirPath, []);
};

/**
 * Upload HLS Artifacts to S3
 * @param {*} location
 * @param {*} dirpath
 */
const uploadDirectory = async (s3, bucket, path, dirpath) => {
  try {
    const allFiles = getAllFiles(dirpath);
    const uploadPromises = allFiles.map(async (rPath) => {
      let params = {
        Bucket: bucket,
        Key: slasher(`${path}${rPath.substring(dirpath.length)}`),
        Body: readFileSync(rPath),
        // ACL: "public-read",
        // CacheControl: "max-age=31536000",
        ContentType: getType(rPath),
      };
      return s3.putObject(params).promise();
    });

    await Promise.all(uploadPromises);
  } catch (err) {
    logger.log(err);
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
    const s3 = new AWS.S3({
      region: options.region,
      accessKeyId: options.key,
      secretAccessKey: options.secret,
    });

    const actions = options.use.map(async (step, index) => {
      let taskDefination = options[step];
      const target = taskDefination.output;
      const isDirectory = statSync(target).isDirectory();
      if (isDirectory) {
        return uploadDirectory(s3, options.bucket, options.path, target);
      } else {
        // return await uploadMergeVideoOutput(
        //   join(target, process.env.OUTPUT),
        //   videoOut
        // );
      }
    });

    const s3StoreRes = await Promise.all(actions);

    return {
      [options.type]: {
        agent: options.agent,
        renderId: options.renderId,
      },
    };
    // const rootOutputDir = join(body.folder);
    // logger.info(
    //   `Output Video and Output HLS will be avaiable at - ${rootOutputDir}`
    // );
    // logger.info("Video Uploading started");
    // await uploadMergeVideoOutput(
    //   join(rootOutputDir, process.env.OUTPUT),
    //   videoOut
    // );
    // logger.info("Video Upload Complete");
    // logger.info("Start Uploading HLS");
    // await uploadm3u8Artifacts(
    //   join(rootOutputDir, process.env.OUTPUT_HLS_DIR),
    //   hlsOut
    // );
    // logger.info("HLS Upload Complete");
    // logger.info("Final Exit (Successfull)");
    // await uploadLoggerFiles(
    //   join(rootOutputDir, process.env.INFO_LOG),
    //   join(process.env.ROOT_TEMP_DIR, process.env.INFO_LOG)
    // );

    // return {
    //   import: {
    //     agent: body.agent,
    //     renderId: body.renderId,
    //     input,
    //   },
    // };
  } catch (err) {
    throw err;
  }
};
