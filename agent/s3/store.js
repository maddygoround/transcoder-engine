const AWS = require("aws-sdk");
const { join, sep } = require("path");
const { logger } = require("../../logger");
const { getType } = require("mime");
const { tim } = require("tinytim");
const { readFile } = require("fs").promises;
const { readdirSync, readFileSync, statSync } = require("fs");
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
 * Upload Final Video Output to s3
 * @param {*} location
 * @param {*} outputVideoPath
 */
const uploadFile = async (s3, bucket, path, target) => {
  try {
    const body = await readFile(target);
    return s3
      .putObject({
        Bucket: bucket,
        Key: slasher(join(path, process.env.OUTPUT)),
        Body: body,
        ContentType: getType(target),
      })
      .promise();
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
      options.path = tim(options.path, options);
      if (isDirectory) {
        return uploadDirectory(s3, options.bucket, options.path, target);
      } else {
        return uploadFile(s3, options.bucket, options.path, target);
      }
    });

    await Promise.all(actions);

    return {
      [options.type]: {
        use: options.use,
        output: options.path,
        agent: options.agent,
        job: options.job,
      },
    };
  } catch (err) {
    throw err;
  }
};
