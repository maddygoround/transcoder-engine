/******************************************************************
 *
 * Module is reponsible triggering the CLI operations.
 * @author  Mahendra R
 * @version 1.0
 * @since   2021-02-01
 *
 *******************************************************************/
const execa = require("execa");

const {
  convertMergeToHLSAbr,
  mergeTsToOutput,
  outputVideoToTS,
  mergeAndOverlayOutout,
  getVideoMetadataCmd,
} = require("./commands");
const { logger } = require("./logger");
module.exports = async (options) => {
  try {
    logger.info(`Output Video Location - ${options.output}`);

    const outputLoc = options.output;
    const hlsOutLoc = options.hlsOut;
    const logo = options.logo;
    await mergeOverlayOutputAndSaveToDir(
      outputLoc,
      { intro: options.intro, course: options.course, outro: options.outro },
      logo
    );
    await convertToHLSAbrAndSaveToDir(outputLoc, hlsOutLoc);

    return {
      hlsOut: hlsOutLoc,
      videoOut: outputLoc,
    };
  } catch (error) {
    throw error;
  }
};

// const getVideoMetadata = async (videoUrl) => {
//   logger.info("Get Video Metdata");
//   try {
//     const { cmd, args } = getVideoMetadataCmd(videoUrl);
//     const { stdout } = await execa(cmd, args);
//     return stdout;
//   } catch (error) {
//     throw new Error(error.message);
//   }
// };

const convertToHLSAbrAndSaveToDir = async (inputFile, outputLoc) => {
  try {
    logger.info(`${inputFile} is going to convert to ABR`);
    const { cmd, args } = convertMergeToHLSAbr(inputFile, outputLoc);
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

// const mergeVideosAndSaveToDir = async (outputLoc, inputFile) => {
//   logger.info(`${inputFile} is going to merge`);
//   try {
//     const { cmd, args } = mergeTsToOutput(inputFile, outputLoc);
//     await execa(cmd, args);
//   } catch (error) {
//     logger.error(`${inputFile} failed to merge - ${JSON.stringify(error)}`);
//     throw new Error(error.message);
//   }
// };

// const outputToTs = async (inputFile, outputLoc) => {
//   logger.info(`${inputFile} is converting to TS`);
//   try {
//     const { cmd, args } = outputVideoToTS(inputFile, outputLoc);
//     await execa(cmd, args);
//   } catch (error) {
//     logger.error(`${inputFile} failed to convert - ${JSON.stringify(error)}`);
//     throw new Error(error.message);
//   }
// };
