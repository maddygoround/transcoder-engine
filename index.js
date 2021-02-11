#!/usr/bin/env node
/******************************************************************
 *
 * Module is entry point for the transcoding Jobs
 * @author  Mahendra R
 * @version 1.0
 * @since   2021-02-04
 *
 *******************************************************************/
// require("dotenv").config();
const uuid = require("uuid");
const rimraf = require("rimraf");
const axios = require("axios");

/** layer libs */
const { logger } = require("./logger");

const handler = async (body) => {
  // const response = await axios.get(
  //   `${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`
  // );
  // logger.info(`ECS Docker Data - ${JSON.stringify(response.data)}`);
  // // get ecsId from from task ARN
  // const taskParts = response.data.TaskARN.split("/");
  // const taskId = taskParts[taskParts.length - 1];

  const job = { id: "d2575f2f-0c32-4c73-804c-255f3cb5aeaf" }; //uuid.v4() };

  try {
    let result = {};
    for (const task of body.tasks) {
      let taskDefination = body[task];
      taskDefination.type = task;
      taskDefination = { ...taskDefination, ...result, job };
      if (Array.isArray(taskDefination.use)) {
        taskDefination = {
          ...taskDefination,
          ...taskDefination.use.map((step) => {
            return body[step];
          }),
        };
      } else if (taskDefination.use) {
        if (taskDefination.use.steps) {
          taskDefination = {
            ...taskDefination,
            ...taskDefination.use.steps.map((step) => {
              return body[step];
            }),
          };
        }
      }
      result = {
        ...result,
        ...(await require(`./agent${taskDefination.agent}`)(taskDefination)),
      };
    }

    logger.info(`Final Exit (Success) ${JSON.stringify(result)}`);

    // remove temp storage after the rendering is complete
    //   rimraf.sync(job.id);
    process.exit(0);
  } catch (error) {
    logger.error(`Final Exit (Failure) ${JSON.stringify(error)}`);

    // remove temp storage after the rendering is complete
    //  rimraf.sync(job.id);
    process.exit(1);
  }
};

(async () => {
  const event = {
    import: {
      agent: "/s3/import",
      region: "us-east-1",
      bucket: "transcode-input-bkt",
      key: "AKIA6OYUVTFHXGAR7QFN",
      secret: "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",
      path: "IAMICON_Russian.mp4",
    },
    watermark: {
      use: "import",
      agent: "/video/encode",
      watermark_alpha: 0.5,
      watermark_size: "25%",
      watermark_url:
        "https://demos.transloadit.com/inputs/transloadit-padded.png",
      watermark_position: "top-right",
    },
    hls_240: {
      use: "watermark",
      agent: "/video/encode",
      preset: "hls-240p",
    },
    hls_360: {
      use: "watermark",
      agent: "/video/encode",
      preset: "hls-360p",
    },
    hls_720: {
      use: "watermark",
      agent: "/video/encode",
      preset: "hls-720p",
    },
    hls_1080: {
      use: "watermark",
      agent: "/video/encode",
      preset: "hls-1080p",
    },
    hls_2160: {
      use: "watermark",
      agent: "/video/encode",
      preset: "hls-2160p",
    },
    transcode: {
      use: {
        steps: ["hls_240", "hls_360"],
        bundle_steps: true,
      },
      agent: "/video/adaptive",
      playlist_name: "playlist.m3u8",
      technique: "hls",
    },
    export: {
      use: ["watermark"],
      region: "us-east-1",
      agent: "/s3/store",
      bucket: "transcoder-output-bkt",
      key: "AKIA6OYUVTFHXGAR7QFN",
      secret: "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",
      path: "hls/{{job.id}}",
    },
    tasks: ["import", "watermark", "transcode"],
  };
  //const event = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_EVENT);
  await handler(event);
})();
