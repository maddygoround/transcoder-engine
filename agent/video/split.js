const { doCutsWithEncoding, doCutsWithoutEncoding } = require("../../commands");
const {
  createDirIfNotDitch,
  readVideoFileInfo,
  runWorker,
} = require("../../utils");
const { join } = require("path");
const execa = require("execa");

module.exports = async (options) => {
  try {
    const { duration } = await readVideoFileInfo(options[options.use].input);
    const source = options[options.use].input;
    let target;
    let ext;
    if (!target) {
      ext = /\.[^.]*$/.exec(source)[0];
      target = join(
        options[options.use].job.id,
        process.env.SPLIT_OUTPUT_FOLDER_KEY
      );
    }

    let func;
    if (options.encode_to) {
      ext = `.${options.encode_to}`;
      if (ext === /\.[^.]*$/.exec(source)[0]) {
        func = doCutsWithoutEncoding;
      } else {
        func = doCutsWithEncoding;
      }
    } else {
      func = doCutsWithoutEncoding;
    }

    createDirIfNotDitch(target);

    let cutDuration;
    if (options.end) {
      if (options.end > duration) {
        cutDuration = duration - options.start;
      } else {
        cutDuration = options.end - options.start;
      }
    } else {
      cutDuration = duration - options.start;
    }

    if (options.every) {
      const loops = Math.round(cutDuration / options.every);
      const cmds = [...Array(loops).keys()].map((index, i) => {
        const cutFrom = options.start + i * options.every;
        const { cmd, args } = func(
          source,
          cutFrom,
          options.every,
          join(target, `cuts_${i}${ext}`)
        );

        return runWorker({ cmd, args });
      });

      await Promise.all(cmds);
    } else {
      const { cmd, args } = func(
        source,
        options.start,
        cutDuration,
        join(target, `cuts${ext}`)
      );

      await execa(cmd, args);
      console.log;
    }
  } catch (err) {
    throw err;
  }
};
