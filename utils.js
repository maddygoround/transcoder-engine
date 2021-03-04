const { writeFile } = require("fs").promises;
const { existsSync, mkdirSync, createWriteStream } = require("fs");
const axios = require("axios");
const { format, parse } = require("path");
const { getType, getExtension } = require("mime");
const execa = require("execa");
const { Worker } = require("worker_threads");
const assert = require("assert");
const FFMPEG_PATH = "/usr/local/bin/ffmpeg"; //"/opt/bin/ffmpeg";
const FFPROBE_PATH = "/usr/local/bin/ffprobe"; ///opt/bin/ffprobe";
/**
 * Create directory to proccess video
 * @param {*} dir
 */
module.exports.createDirIfNotDitch = (dir) => {
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir);
    }
    return true;
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports.readFileStreams = async (p) => {
  const { stdout } = await execa(FFPROBE_PATH, [
    "-show_entries",
    "stream",
    "-of",
    "json",
    p,
  ]);
  const json = JSON.parse(stdout);
  return json.streams;
};

const readDuration = async (p) => {
  const { stdout } = await execa(FFPROBE_PATH, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    p,
  ]);
  const parsed = parseFloat(stdout);
  assert(!Number.isNaN(parsed));
  return parsed;
};

module.exports.readVideoFileInfo = async (p) => {
  try {
    const streams = await this.readFileStreams(p);
    const stream = streams.find((s) => s.codec_type === "video"); // TODO

    const duration = stream.duration
      ? parseFloat(stream.duration)
      : await readDuration(p);
    assert(!Number.isNaN(duration));
    const rotation =
      stream.tags && stream.tags.rotate && parseInt(stream.tags.rotate, 10);
    return {
      // numFrames: parseInt(stream.nb_frames, 10),
      duration,
      width: stream.width, // TODO coded_width?
      height: stream.height,
      framerateStr: stream.r_frame_rate,
      rotation: !Number.isNaN(rotation) ? rotation : undefined,
    };
  } catch (err) {
    throw err;
  }
};

module.exports.runWorker = (workerData) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker("./ffmpeg_worker.js", { workerData });
    worker.on("message", (res) => {
      resolve(res);
    });
    worker.on("error", (err) => {
      console.log(err);
      reject(err);
    });
    worker.on("exit", (code) => {
      if (code !== 0)
        reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
};
/**
 * Create directory to proccess video
 * @param {*} dir
 */
module.exports.download = async (url, dest) => {
  try {
    const response = await axios.get(url, {
      responseType: "stream",
    });

    return new Promise((resolve, reject) => {
      const videoType = getType(response.request.path);
      const fileExt = getExtension(videoType);
      dest = format({
        ...parse(dest),
        base: undefined,
        ext: `.${fileExt}`,
      });
      return resolve(dest);
      // response.data
      //   .pipe(
      //     createWriteStream(dest)
      //       .on("finish", () => {
      //         return resolve(dest);
      //       })
      //       .on("error", (e) => {
      //         return reject(e);
      //       })
      //   )
      //   .on("error", (e) => {
      //     return reject(e);
      //   });
    });
  } catch (err) {
    throw err;
  }
};
