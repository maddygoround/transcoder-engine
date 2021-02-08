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
const wasabiEndpoint = new AWS.Endpoint(process.env.WASABI_ENDPOINT);
const { getType } = require("mime");
const rimraf = require("rimraf");
const im = require("imagemagick");
/** layer libs */
const ffmpegEngine = require("./engine");
const { logger } = require("./logger");

const s3 = new AWS.S3({
  endpoint: wasabiEndpoint,
  region: process.env.WASABI_REGION,
  accessKeyId: process.env.WASABI_ACCESS_KEY,
  secretAccessKey: process.env.WASABI_SECRET_KEY,
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
  const renderId = "ab17986b-d05e-4923-92f3-3dad0a9f54b9"; //uuid.v4();
  const tempStorageDir = join(process.env.ROOT_TEMP_DIR, renderId);

  try {
    logger.info(`Render Id - ${renderId}`);
    const tempIntroFileLoc = join(tempStorageDir, process.env.INTRO);
    const tempOutroFileLoc = join(tempStorageDir, process.env.OUTRO);
    const tempCourseFileLoc = join(tempStorageDir, process.env.COURSE);
    const tempLogoLoc = join(tempStorageDir, process.env.LOGO);
    const outputFileLoc = join(tempStorageDir, process.env.OUTPUT);
    const hlsOutLoc = join(tempStorageDir, "outputs");
    const isProcessVideo = body.is_process_video;
    const isAes = body.is_aes;

    /**
     * create pitch directory for temp
     */
    logger.info(`Creating output directory`);
    createDirIfNotDitch(tempStorageDir);
    createDirIfNotDitch(hlsOutLoc);
    /**
     * download assets from bucket
     */
    const coursePath =
      body.type === "custom"
        ? join(body.inputbase, body.orgId)
        : join(body.baseref, "pre", body.orgId, body.folder);

    const basePath = join(body.baseref, "pre", body.orgId);

    // logger.info(`Downloading Video Assests`);
    // const downloadAssetsQueue = [downloadAsset(join(coursePath, body.file))];
    // if (isProcessVideo) {
    //   downloadAssetsQueue.push(downloadAsset(join(basePath, body.intro)));
    //   downloadAssetsQueue.push(downloadAsset(join(basePath, body.outro)));
    //   downloadAssetsQueue.push(downloadAsset(join(basePath, body.logo)));
    // }
    // const response = await Promise.all(downloadAssetsQueue);
    // logger.info(`Video Assests Downloaded`);

    // /**
    //  * write assets to temp directory
    //  */
    // logger.info(`Writing Videos to Output Directory`);
    // const writeAssetsQueue = [writeFile(tempCourseFileLoc, response[0].Body)];

    // if (isProcessVideo) {
    //   writeAssetsQueue.push(writeFile(tempIntroFileLoc, response[1].Body));
    //   writeAssetsQueue.push(writeFile(tempOutroFileLoc, response[2].Body));
    //   writeAssetsQueue.push(writeFile(tempLogoLoc, response[3].Body));
    // }

    // await Promise.all(writeAssetsQueue);
    // logger.info(`Videos saved to directory`);

    if (isProcessVideo) {
      /** resize logo to 120x120 */
      await resizeLogoAndSave(tempLogoLoc);
    }
    /**
     * proccess video for transcoding
     */
    const { hlsOut, videoOut } = await ffmpegEngine({
      output: outputFileLoc,
      hlsOut: hlsOutLoc,
      intro: tempIntroFileLoc,
      outro: tempOutroFileLoc,
      course: tempCourseFileLoc,
      logo: tempLogoLoc,
      isProcessVideo,
      isAes,
    });

    const rootOutputDir = join(body.baseref, "post", body.orgId, body.folder);

    logger.info(
      `Output Video and Output HLS will be avaiable at - ${rootOutputDir}`
    );

    logger.info("Video Uploading started");
    await uploadMergeVideoOutput(
      join(rootOutputDir, process.env.OUTPUT),
      videoOut
    );
    logger.info("Video Upload Complete");

    logger.info("Start Uploading HLS");
    await uploadm3u8Artifacts(
      join(rootOutputDir, process.env.OUTPUT_HLS_DIR),
      hlsOut
    );
    logger.info("HLS Upload Complete");

    logger.info("Final Exit (Successfull)");

    await uploadLoggerFiles(
      join(rootOutputDir, process.env.INFO_LOG),
      join(process.env.ROOT_TEMP_DIR, process.env.INFO_LOG)
    );

    /**
     * remove temp storage after the rendering is complete
     */
    // rimraf.sync(tempStorageDir);
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
    //  rimraf.sync(tempStorageDir);
    process.exit(1);
  }
};

(async () => {
  const event = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_EVENT);
  await handler(event);
})();
