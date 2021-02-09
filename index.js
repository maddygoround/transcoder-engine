#!/usr/bin/env node
/******************************************************************
 *
 * Module is entry point for the transcoding Jobs
 * @author  Mahendra R
 * @version 1.0
 * @since   2021-02-04
 *
 *******************************************************************/
require("dotenv").config();
const { writeFile, readFile } = require("fs").promises;
const {
  existsSync,
  readdir,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} = require("fs");
const { join, sep } = require("path");
const uuid = require("uuid");
const AWS = require("aws-sdk");
const { getType } = require("mime");
const rimraf = require("rimraf");
const im = require("imagemagick");

/** layer libs */
const ffmpegEngine = require("./engine");
const { logger } = require("./logger");

const s3 = new AWS.S3({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY,
  secretAccessKey: process.env.SECRET_KEY,
});

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
const uploadm3u8Artifacts = async (location, dirpath) => {
  try {
    const allFiles = getAllFiles(dirpath);
    const uploadPromises = allFiles.map(async (rPath) => {
      let params = {
        Bucket: process.env.BUCKET,
        Key: `${location}${rPath.substring(dirpath.length)}`,
        Body: readFileSync(rPath),
        ACL: "public-read",
        CacheControl: "max-age=31536000",
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
const uploadMergeVideoOutput = async (location, outputVideoPath) => {
  try {
    const body = await readFile(outputVideoPath);
    return s3
      .putObject({
        Bucket: process.env.BUCKET,
        Key: location,
        Body: body,
        ContentType: getType(outputVideoPath),
      })
      .promise();
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * Upload Log files to s3
 * @param {*} location
 * @param {*} path
 */
const uploadLoggerFiles = async (location, path) => {
  try {
    const body = await readFile(path);
    return s3
      .putObject({
        Bucket: process.env.BUCKET,
        Key: location,
        Body: body,
        ContentType: getType(path),
      })
      .promise();
  } catch (error) {
    throw new Error(error.message);
  }
};

/**
 * Donwload Video Assets from s3
 * @param {*} bucket
 * @param {*} template
 */
const downloadAsset = (asset) => {
  try {
    return s3.getObject({ Bucket: process.env.BUCKET, Key: asset }).promise();
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

const resizeLogoAndSave = (logo) => {
  return new Promise((resolve, reject) => {
    im.resize(
      {
        srcPath: logo,
        dstPath: logo,
        width: 120,
      },
      function (err, stdout, stderr) {
        if (err) reject(err);
        resolve();
      }
    );
  });
};

const handler = async (body) => {
  const renderId = uuid.v4();
  try {
    let result = {};
    for (const task of body.tasks) {
      let taskDefination = body[task];
      taskDefination.type = task;
      taskDefination = { ...taskDefination, renderId, ...result };
      if (Array.isArray(taskDefination.use)) {
        taskDefination = {
          ...taskDefination,
          ...taskDefination.use.map((step) => {
            return body[step];
          }),
        };
      } else if (taskDefination.use) {
        if (taskDefination.use.steps) {
          taskDefination = {
            ...taskDefination,
            ...taskDefination.use.steps.map((step) => {
              return body[step];
            }),
          };
        }
      }
      result = {
        ...result,
        ...(await require(`./agent${taskDefination.agent}`)(taskDefination)),
      };
    }

    logger.info(`Job Result ${JSON.stringify(result)}`);

    await uploadLoggerFiles(
      join(rootOutputDir, process.env.INFO_LOG),
      join(process.env.ROOT_TEMP_DIR, process.env.INFO_LOG)
    );
    /**
     * remove temp storage after the rendering is complete
     */
    rimraf.sync(tempStorageDir);
    process.exit(0);
  } catch (error) {
    logger.error(`Final Exit (Failure) ${JSON.stringify(error)}`);
    await uploadLoggerFiles(
      join(body.baseref, "post", body.orgId, process.env.ERROR_LOG),
      join(process.env.ROOT_TEMP_DIR, process.env.ERROR_LOG)
    );
    /**
     * remove temp storage after the rendering is complete
     */
    rimraf.sync(tempStorageDir);
    process.exit(1);
  }
};

(async () => {
  const event = {
    import: {
      agent: "/s3/import",
      region: "us-east-1",
      bucket: "transcode-input-bkt",
      key: "AKIA6OYUVTFHXGAR7QFN",
      secret: "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",
      path: "IAMICON_Russian.mp4",
    },
    hls_240: {
      use: "import",
      agent: "/video/encode",
      preset: "hls-240p",
    },
    hls_360: {
      use: "import",
      agent: "/video/encode",
      preset: "hls-360p",
    },
    hls_720: {
      use: "import",
      agent: "/video/encode",
      preset: "hls-720p",
    },
    transcode: {
      use: {
        steps: ["hls_240", "hls_360", "hls_720"],
        bundle_steps: true,
      },
      agent: "/video/adaptive",
      playlist_name: "playlist.m3u8",
      technique: "hls",
    },
    export: {
      use: ["transcode"],
      region: "us-east-1",
      agent: "/s3/store",
      bucket: "transcoder-output-bkt",
      key: "AKIA6OYUVTFHXGAR7QFN",
      secret: "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",
      path: "hls/",
    },
    tasks: ["import", "transcode", "export"],
  };
  // const event = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_EVENT);
  await handler(event);
})();
