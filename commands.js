/******************************************************************
 *
 * Module is reponsible for handling all cli commands.
 * FFMPEG  Commands are related to FFMPEG BUILD for Video Processing.
 * @author  Mahendra R
 * @version 1.0
 * @since   2021-01-29
 *
 *******************************************************************/

const FFMPEG_PATH = "/usr/local/bin/ffmpeg"; //"/opt/bin/ffmpeg";
const FFPROBE_PATH = "/usr/local/bin/ffprobe"; ///opt/bin/ffprobe";
const { parseArgsStringToArgv } = require("string-argv");

module.exports = {
  getVersionCmd: () => {
    var COMMAND = "-version";
    return { cmd: FFMPEG_PATH, args: parseArgsStringToArgv(COMMAND) };
  },

  mergeVideoToOutput: (inputFile, output) => {
    var COMMAND =
      "-y -f concat -safe 0 -i [INPUT_FILE] -vcodec copy -acodec copy [OUTPUT]";
    COMMAND = COMMAND.replaceAll("[INPUT_FILE]", inputFile);
    COMMAND = COMMAND.replaceAll("[OUTPUT]", output);
    return { cmd: FFMPEG_PATH, args: parseArgsStringToArgv(COMMAND) };
  },

  mergeAndOverlayOutout: (input, logo, output) => {
    var COMMAND =
      "-y -i [INTRO] -i [COURSE] -i [OUTRO] -i [LOGO] -filter_complex '[0:v]scale=1280:720:force_original_aspect_ratio=1[v0]; [1:v]scale=1280:720:force_original_aspect_ratio=1[v1]; [2:v]scale=1280:720:force_original_aspect_ratio=1[v2]; [v0][0:a][v1][1:a][v2][2:a]concat=n=3:v=1:a=1[v][a];[3]format=rgba,colorchannelmixer=aa=0.7[3:v];[v][3:v]overlay=15:15[v]' -map [v] -map [a] -vsync 2 -preset veryfast -movflags faststart [OUTPUT]";
    COMMAND = COMMAND.replaceAll("[INTRO]", input.intro);
    COMMAND = COMMAND.replaceAll("[COURSE]", input.course);
    COMMAND = COMMAND.replaceAll("[OUTRO]", input.outro);
    COMMAND = COMMAND.replaceAll("[LOGO]", logo);
    COMMAND = COMMAND.replaceAll("[OUTPUT]", output);
    return { cmd: FFMPEG_PATH, args: parseArgsStringToArgv(COMMAND) };
  },

  mergeTsToOutput: (inputFile, output) => {
    var COMMAND =
      "-y -f concat -safe 0 -i [INPUT_FILE] -vcodec copy -acodec copy [OUTPUT]";
    COMMAND = COMMAND.replaceAll("[INPUT_FILE]", inputFile);
    COMMAND = COMMAND.replaceAll("[OUTPUT]", output);
    return { cmd: FFMPEG_PATH, args: parseArgsStringToArgv(COMMAND) };
  },

  outputVideoToTS: (inputFile, output) => {
    var COMMAND =
      "-i [INPUT_FILE] -c copy -bsf:v h264_mp4toannexb -f mpegts [OUTPUT]";
    COMMAND = COMMAND.replaceAll("[INPUT_FILE]", inputFile);
    COMMAND = COMMAND.replaceAll("[OUTPUT]", output);
    return { cmd: FFMPEG_PATH, args: parseArgsStringToArgv(COMMAND) };
  },

  convertMergeToHLS: (input, outputDir) => {
    var COMMAND =
      "-y -i [INPUT] -profile:v main -vf scale=w=1280:h=720:force_original_aspect_ratio=decrease -c:a aac -ar 48000 -b:a 128k -c:v h264 -crf 20 -g 48 -keyint_min 48 -sc_threshold 0 -b:v 1200k -maxrate 1200k -bufsize 4200k -hls_time 6 -hls_segment_filename [OUTPUT_DIR]/720p_%03d.ts -hls_playlist_type vod -f hls [OUTPUT_DIR]/720p.m3u8";
    COMMAND = COMMAND.replaceAll("[OUTPUT_DIR]", outputDir);
    COMMAND = COMMAND.replaceAll("[INPUT]", input);
    return { cmd: FFMPEG_PATH, args: parseArgsStringToArgv(COMMAND) };
  },

  convertMergeToHLSAbr: (input, outputDir, doEncrypt) => {
    var COMMAND = "[ENC_FLAG] [INPUT] [OUTPUT_DIR]";
    COMMAND = COMMAND.replaceAll("[OUTPUT_DIR]", outputDir);
    COMMAND = COMMAND.replaceAll("[INPUT]", input);
    COMMAND = COMMAND.replaceAll("[ENC_FLAG]", doEncrypt);
    return { cmd: "./convert-to-hls.sh", args: parseArgsStringToArgv(COMMAND) };
  },

  outputTransCodeCMD: (CMD) => {
    console.log(CMD);
    return { cmd: FFMPEG_PATH, args: parseArgsStringToArgv(CMD) };
  },

  getVideoMetadataCmd: (videoUrl) => {
    let COMMAND =
      "-v quiet -print_format json -show_format -show_streams [INPUT_VIDEO]";
    COMMAND = COMMAND.replace("[INPUT_VIDEO]", videoUrl);
    return { cmd: FFPROBE_PATH, args: parseArgsStringToArgv(COMMAND) };
  },
};

String.prototype.replaceAll = function (search, replacement) {
  var target = this;
  return target.split(search).join(replacement);
};
