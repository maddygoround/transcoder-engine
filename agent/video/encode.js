const { mkdirSync, existsSync, createWriteStream } = require("fs");
const { writeFile } = require("fs").promises;
const {
  doTranscode,
  getVideoMetadataCmd,
  doWatermark,
} = require("../../commands");
const { join } = require("path");
const { format } = require("util");
const execa = require("execa");
const axios = require("axios");
const im = require("imagemagick");
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

const hlsRenditions = {
  "hls-240p": {
    resolution: "426x240",
    bitrate: 400,
    audiorate: 64,
  },
  "hls-360p": {
    resolution: "640x360",
    bitrate: 750,
    audiorate: 96,
  },
  "hls-480p": {
    resolution: "842x480",
    bitrate: 1400,
    audiorate: 96,
  },
  "hls-720p": {
    resolution: "1080x720",
    bitrate: 2500,
    audiorate: 128,
  },
  "hls-1080p": {
    resolution: "1920x1080",
    bitrate: 5500,
    audiorate: 192,
  },
  "hls-2160p": {
    resolution: "3840x2160",
    bitrate: 12000,
    audiorate: 192,
  },
};

const watermarkPosition = (watermark_position) => {
  switch (watermark_position) {
    case "bottom-right":
      return "main_w-overlay_w-10:main_h-overlay_h-10";
    case "bottom-left":
      return "10:main_h-overlay_h-10";
    case "top-right":
      return "main_w-overlay_w-10:10";
    case "top-left":
      return "10:10";
    case "center":
      return "main_w/2-overlay_w/2:main_h/2-overlay_h/2";
  }
};

const watermark = async (options) => {
  try {
    const watermarkOptions = {
      alpha: options.watermark_alpha ? options.watermark_alpha : 1,
      position: watermarkPosition(options.watermark_position),
    };

    const source = options[options.use].input;
    let target = options.target;

    if (!target) {
      const ext = /\.[^.]*$/.exec(source)[0];
      target = join(
        options[options.use].job.id,
        format(process.env.WATERMARK_OUTPUT, ext)
      );
    }
    const { cmd, args } = doWatermark(
      source,
      options.watermark_input,
      target,
      watermarkOptions
    );

    await execa(cmd, args);

    return {
      [options.type]: {
        agent: options.agent,
        job: options.job,
        output: target,
        input: target,
      },
    };
  } catch (err) {
    throw err;
  }
};

const toHLS = async (options) => {
  const default_renditions = hlsRenditions[options.preset];
  const rendition = options.profiles
    ? [...default_renditions, ...options.profiles]
    : default_renditions;
  const segment_target_duration = 4; // try to create a new segment every X seconds
  const max_bitrate_ratio = 1.07; // maximum accepted bitrate fluctuations
  const rate_monitor_buffer_ratio = 1.5; // maximum buffer size between bitrate conformance checks
  const encryption_flag = options.is_aes;
  const source = options[options.use].input;

  let target = options.target;

  if (!target) {
    target = join(options[options.use].job.id, process.env.OUTPUT_FOLDER_KEY);
  }
  createDirIfNotDitch(target);

  let key_frames_interval = options.fps * 2;
  if (!key_frames_interval) {
    key_frames_interval = 50;
  }
  key_frames_interval = Math.round(key_frames_interval);
  let static_params =
    "-c:a aac -ar 48000 -c:v h264 -profile:v main -crf 20 -sc_threshold 0";
  static_params += ` -g ${key_frames_interval} -keyint_min ${key_frames_interval} -hls_time ${segment_target_duration}`;
  static_params += " -hls_playlist_type vod";

  //   // if encryption enabled pass keyinfo file
  //   if (encryption_flag) {
  //     static_params += " -hls_key_info_file file.keyinfo";
  //   }

  let misc_params = "-hide_banner -y";

  const resolution = rendition.resolution;
  const bitrate = rendition.bitrate;
  const audiorate = rendition.audiorate;

  // calculated fields
  const width = /^[0-9]+/.exec(resolution)[0];
  const height = /[0-9]+$/.exec(resolution)[0];

  const maxrate = Math.floor(rendition.bitrate * max_bitrate_ratio);
  const bufsize = Math.floor(rendition.bitrate * rate_monitor_buffer_ratio);
  const bandwidth = rendition.bitrate * 1024;
  const name = `${height}p`;

  let ffmpeg_cmd = `${static_params} -vf scale=w=${width}:h=${height}:force_original_aspect_ratio=decrease,pad='iw+mod(iw\\,2)':'ih+mod(ih\\,2)'`;
  ffmpeg_cmd += ` -b:v ${bitrate}k -maxrate ${maxrate}k -bufsize ${bufsize}k -b:a ${audiorate}k`;
  ffmpeg_cmd += ` -hls_segment_filename ${target}/${name}_%03d.ts ${target}/${name}.m3u8`;

  if (options.bundle_steps) {
    return {
      [options.type]: {
        ffmpeg_cmd,
        bandwidth,
        resolution,
        name,
      },
    };
  } else {
    const { cmd, args } = doTranscode(
      `${misc_params} -i ${source} ${ffmpeg_cmd}`
    );
    await execa(cmd, args);
    return {
      [options.type]: {
        agent: options.agent,
        job: options.job,
        output: target,
        input: target,
      },
    };
  }
};

const download = async (url, dest) => {
  try {
    const response = await axios.get(url, {
      responseType: "stream",
    });

    new Promise((resolve, reject) => {
      response.data
        .pipe(createWriteStream(dest))
        .on("finish", () => resolve())
        .on("error", (e) => reject(e));
    });
  } catch (err) {
    throw err;
  }
};

const imageSizeInRatio = (logo, size) => {
  return new Promise((resolve, reject) => {
    im.identify(logo, function (err, features) {
      if (err) reject(err);
      const width = (features.width * size) / 100;
      const height = (features.height * size) / 100;
      resolve({ width, height });
    });
  });
};
const resizeLogoAndSave = (logo, settings) => {
  return new Promise((resolve, reject) => {
    im.resize(
      {
        srcPath: logo,
        dstPath: logo,
        width: settings.width,
        height: settings.height,
      },
      function (err, stdout, stderr) {
        if (err) reject(err);
        resolve();
      }
    );
  });
};

const toMP4 = (options) => {};
module.exports = async (options) => {
  try {
    const videoMetaData = await getVideoMetadata(options[options.use].input);
    const parsedMetaData = JSON.parse(videoMetaData);
    const {
      [0]: duration,
      [1]: frames,
    } = parsedMetaData.streams[0].avg_frame_rate.split("/");
    const fps = parseFloat(duration / frames).toFixed(2);
    if (options.preset) {
      switch (options.preset) {
        case (options.preset.match(/^hls.*/) || {}).input:
          options = { ...options, fps };
          return toHLS(options);
        case "mp4":
          return toMP4(options);
        default:
      }
    } else if (options.type) {
      switch (options.type) {
        case "watermark":
          const pat = /^https?:\/\/|^\/\//i;
          const watermark_input = join(
            options.job.id,
            process.env.WATERMARK_INPUT
          );
          options = { ...options, watermark_input };
          if (pat.test(options.watermark_url)) {
            await download(options.watermark_url, watermark_input);
            if (options.watermark_size) {
              const { height, width } = await imageSizeInRatio(
                watermark_input,
                parseFloat(options.watermark_size.replace("%", ""))
              );
              await resizeLogoAndSave(watermark_input, { width, height });
            }
            return await watermark(options);
          } else {
            switch (options.use) {
            }
          }
      }
    }
    //return options;
  } catch (err) {
    throw err;
  }
};
