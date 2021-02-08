const { mkdirSync, existsSync } = require("fs");
const { writeFile } = require("fs").promises;
const { outputTransCodeCMD } = require("./commands");
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
    const default_renditions = [
      {
        resolution: "426x240",
        bitrate: 400,
        audiorate: 64,
      },
      {
        resolution: "640x360",
        bitrate: 750,
        audiorate: 96,
      },
      {
        resolution: "842x480",
        bitrate: 1400,
        audiorate: 128,
      },
    ];

    const renditions = options.profiles
      ? [...default_renditions, ...options.profiles]
      : default_renditions;
    const segment_target_duration = 4; // try to create a new segment every X seconds
    const max_bitrate_ratio = 1.07; // maximum accepted bitrate fluctuations
    const rate_monitor_buffer_ratio = 1.5; // maximum buffer size between bitrate conformance checks
    const encryption_flag = options.is_aes;
    const source = options.input;
    let target = options.output;
    if (!target) {
      target = /[^/]*$/.exec(source)[0]; //leave only last component of path
      target = target.split(".")[0]; //strip extension
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

    // if encryption enabled pass keyinfo file
    if (encryption_flag) {
      static_params += " -hls_key_info_file file.keyinfo";
    }

    // misc params
    let misc_params = "-hide_banner -y";
    let master_playlist = "#EXTM3U\n#EXT-X-VERSION:3\n";

    const cmd = renditions.map((rendition) => {
      // rendition fields
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

      // add rendition entry in the master playlist
      master_playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n${name}.m3u8\n`;
      return ffmpeg_cmd;
    });

    await writeFile(`${target}/playlist.m3u8`, master_playlist, "utf-8");
    const res = outputTransCodeCMD(
      `${misc_params} -i ${source} ${cmd.join(" ")}`
    );
    return res;
  } catch (err) {
    throw err;
  }
};
