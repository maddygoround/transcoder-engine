/******************************************************************
 *
 * Module is reponsible triggering the CLI operations.
 * @author  Mahendra R
 * @version 1.0
 * @since   2021-02-01
 *
 *******************************************************************/
const execa = require("execa");
const { copyFile } = require("fs").promises;
const {
  convertMergeToHLSAbr,
  mergeAndOverlayOutout,
  getVideoMetadataCmd,
} = require("./commands");
const transcoder = require("./transcoder");
const { logger } = require("./logger");
module.exports = async (options) => {
  try {
    logger.info(`Output Video Location - ${options.output}`);

    const outputLoc = options.output;
    const hlsOutLoc = options.hlsOut;
    const logo = options.logo;

    // if (options.isProcessVideo) {
    //   await mergeOverlayOutputAndSaveToDir(
    //     outputLoc,
    //     { intro: options.intro, course: options.course, outro: options.outro },
    //     logo
    //   );
    // } else {
    //   await copyFile(options.course, options.output);
    // }
    const videoMetaData = await getVideoMetadata(options.output);
    const parsedMetaData = JSON.parse(videoMetaData);
    const {
      [0]: duration,
      [1]: frames,
    } = parsedMetaData.streams[0].avg_frame_rate.split("/");
    const fps = parseFloat(duration / frames).toFixed(2);
    await convertToHLSAbrAndSaveToDir(
      outputLoc,
      hlsOutLoc,
      options.isAes,
      parseFloat(fps)
    );

    return {
      hlsOut: hlsOutLoc,
      videoOut: outputLoc,
    };
  } catch (error) {
    throw error;
  }
};

const getVideoMetadata = async (videoUrl) => {
  console.log("Get Video Metdata");
  try {
    const { cmd, args } = getVideoMetadataCmd(videoUrl);
    const { stdout } = await execa(cmd, args);
    return stdout;
  } catch (error) {
    throw new Error(error.message);
  }
};

const convertToHLSAbrAndSaveToDir = async (
  inputFile,
  outputLoc,
  isAes,
  fps
) => {
  try {
    logger.info(`${inputFile} is going to convert to ABR`);
    const { cmd, args } = await transcoder({
      input: inputFile,
      output: outputLoc,
      is_aes: isAes,
      fps,
    });
    // const { cmd, args } = convertMergeToHLSAbr(inputFile, outputLoc, isAes);
    await execa(cmd, args);
  } catch (error) {
    logger.error(`${inputFile} failed to convert - ${JSON.stringify(error)}`);
    throw new Error(error.message);
  }
};

const mergeOverlayOutputAndSaveToDir = async (outputLoc, inputs, logo) => {
  logger.info(`${JSON.stringify(inputs)} is going to merge`);
  try {
    const { cmd, args } = mergeAndOverlayOutout(inputs, logo, outputLoc);
    await execa(cmd, args);
  } catch (error) {
    logger.error(
      `${JSON.stringify(inputs)} failed to merge - ${JSON.stringify(error)}`
    );
    throw new Error(error.message);
  }
};
