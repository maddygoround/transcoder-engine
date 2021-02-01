#!/usr/bin/env node
const { writeFile, readFile } = require("fs").promises;
const {
  existsSync,
  mkdirSync,
  createWriteStream,
  unlinkSync,
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

/**
 * Remove inout file
 * @param {*} dir
 */
const removeDirIfExists = (dir) => {
  try {
    if (existsSync(dir)) {
      unlinkSync(dir);
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
  const tempStorageDir = join(process.env.ROOT_TEMP_DIR, renderId);

  try {
    logger.info(`Render Id - ${renderId}`);
    const tempIntroFileLoc = join(tempStorageDir, process.env.INTRO);
    const tempOutroFileLoc = join(tempStorageDir, process.env.OUTRO);
    const tempCourseFileLoc = join(tempStorageDir, process.env.COURSE);
    const tempLogoLoc = join(tempStorageDir, process.env.LOGO);
    // const tempMergeFileLoc = join(tempStorageDir, process.env.MERGE_FILE_NAME);

    // const tempIntroTSFileLoc = join(tempStorageDir, process.env.INTROTS);
    // const tempOutroTSFileLoc = join(tempStorageDir, process.env.OUTROTS);
    // const tempCourseTSFileLoc = join(tempStorageDir, process.env.COURSETS);

    const outputFileLoc = join(tempStorageDir, process.env.OUTPUT);
    const hlsOutLoc = join(tempStorageDir, "outputs");

    /**
     * create pitch directory for temp
     */
    logger.info(`Creating output directory`);
    createDirIfNotDitch(tempStorageDir);
    createDirIfNotDitch(hlsOutLoc);

    // logger.info(`Remove input.txt if exists`);
    // removeDirIfExists(tempMergeFileLoc);

    /**
     * download assets from bucket
     */
    logger.info(`Downloading Video Assests`);
    const downLoadAssetsPromises = [
      downloadAsset(join(body.read_from, body.client_id, body.intro)),
      downloadAsset(join(body.read_from, body.client_id, body.outro)),
      downloadAsset(join(body.read_from, body.client_id, body.course)),
      downloadAsset(join(body.read_from, body.client_id, body.logo)),
    ];

    const response = await Promise.all(downLoadAssetsPromises);
    logger.info(`Video Assests Downloaded`);

    /**
     * write assets to temp directory
     */
    logger.info(`Writing Videos to Output Directory`);
    const fileWritePromises = [
      writeFile(tempIntroFileLoc, response[0].Body),
      writeFile(tempOutroFileLoc, response[1].Body),
      writeFile(tempCourseFileLoc, response[2].Body),
      writeFile(tempLogoLoc, response[3].Body),
    ];

    await Promise.all(fileWritePromises);
    logger.info(`Videos saved to directory`);

    /** resize logo to 120x120 */
    await resizeLogoAndSave(tempLogoLoc);
    /**
     * write file location to txt for merging
     */
    // const fileLogger = createWriteStream(tempMergeFileLoc, {
    //   flags: "a",
    // });

    // fileLogger.write(`file ${tempIntroTSFileLoc}\r\n`);ls
    // fileLogger.write(`file ${tempCourseTSFileLoc}\r\n`);
    // fileLogger.write(`file ${tempOutroTSFileLoc}`);
    // fileLogger.end();

    /**
     * proccess video for transcoding
     */
    const { hlsOut, videoOut } = await ffmpegEngine({
      // input: tempMergeFileLoc,
      output: outputFileLoc,
      hlsOut: hlsOutLoc,
      intro: tempIntroFileLoc,
      outro: tempOutroFileLoc,
      course: tempCourseFileLoc,
      logo: tempLogoLoc,
    });

    const rootOutputDir = join(body.write_to, body.client_id, renderId);

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
    rimraf.sync(tempStorageDir);
    process.exit(0);
  } catch (error) {
    logger.error(`Final Exit (Failure) ${JSON.stringify(error)}`);
    await uploadLoggerFiles(
      join(body.write_to, body.client_id, renderId, process.env.ERROR_LOG),
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
    read_from: "us/staging/pre",
    write_to: "us/staging/post",
    client_id: "mb1220",
    logo: "logo.png",
    intro: "intro1.mp4",
    outro: "outro1.mp4",
    course: "course.mp4",
  };
  //const event = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_EVENT);
  await handler(event);
})();
