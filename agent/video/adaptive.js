const { mkdirSync, existsSync } = require("fs");
const { writeFile } = require("fs").promises;
const { doTranscode } = require("../../commands");
const { join } = require("path");
const execa = require("execa");
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
  const misc_params = "-hide_banner -y";
  const target = join(options.job.id, process.env.OUTPUT_FOLDER_KEY);
  let source;
  const actions = options.use.steps.map((step, index) => {
    let taskDefination = options[index];
    source = options[taskDefination.use].input;
    taskDefination.type = step;
    taskDefination = {
      ...taskDefination,
      job: options.job,
    };
    if (taskDefination.use) {
      taskDefination = {
        ...taskDefination,
        [taskDefination.use]: options[taskDefination.use],
        bundle_steps: options.use.bundle_steps,
        target,
      };
    }
    return require(`..${taskDefination.agent}`)(taskDefination);
  });

  const encodeRes = await Promise.all(actions);

  if (options.use.bundle_steps) {
    let master_playlist = "#EXTM3U\n#EXT-X-VERSION:3\n";
    const ffmpegCMD = encodeRes.map((encode) => {
      const encodeKey = Object.keys(encode)[0];
      master_playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${encode[encodeKey].bandwidth},RESOLUTION=${encode[encodeKey].resolution}\n${encode[encodeKey].name}.m3u8\n`;
      return encode[encodeKey].ffmpeg_cmd;
    });

    await writeFile(
      `${target}/${options.playlist_name}`,
      master_playlist,
      "utf-8"
    );

    let t0 = Date.now();
    const { cmd, args } = doTranscode(
      `${misc_params} -i ${source} ${ffmpegCMD.join(" ")}`
    );

    await execa(cmd, args);
    console.log(Date.now() - t0);

    return {
      [options.type]: {
        agent: options.agent,
        job: options.job,
        output: target,
      },
    };
  }
};
