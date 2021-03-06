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

const { size, sum, publisher } = require("./utils");
/** layer libs */
const { logger } = require("./logger");
const { Credentials } = require("aws-sdk");

const handler = async (body) => {
  let job = { id: "e04b84b1-e32a-4082-b928-a90a572c7229" }; //uuid.v4() };

  if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
    const response = await axios.get(
      `${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`
    );
    logger.info(`ECS Docker Data - ${JSON.stringify(response.data)}`);
    // get ecsId from from task ARN
    const taskParts = response.data.TaskARN.split("/");
    const taskId = taskParts[taskParts.length - 1];
    job.id = taskId;
  }

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

    const usagePromise = result.export.use.map((use) => {
      return size(result[use].output);
    });

    const usgaeRes = await Promise.all(usagePromise);
    body.systemParams = { ...body.systemParams, usage: usgaeRes.reduce(sum) };

    if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
      const taskDetail = {
        detail: {
          taskArn: response.data.TaskARN,
          lastStatus: response.data.KnownStatus,
          createdAt: response.data.Containers.CreatedAt,
          overrides: {
            containerOverrides: [
              {
                environment: [
                  {
                    name: "env",
                    value: JSON.stringify(body),
                  },
                ],
              },
            ],
          },
        },
      };
      logger.info(`TaskDetail to Publish ${JSON.stringify(taskDetail)}`);
      await publisher(taskDetail);
    }

    logger.info(`Final Exit (Success) ${JSON.stringify(result)}`);

    // remove temp storage after the rendering is complete
    rimraf.sync(job.id);
    process.exit(0);
  } catch (error) {
    logger.error(`Final Exit (Failure) ${JSON.stringify(error)}`);

    // remove temp storage after the rendering is complete
    rimraf.sync(job.id);
    process.exit(1);
  }
};

(async () => {
  const event = {
    import: {
      agent: "/video/import",
      url:
        "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    },
    watermarked: {
      use: "import",
      agent: "/video/encode",
      watermark_alpha: 0.5,
      watermark_size: "25%",
      watermark_url: "https://transcode-input-bkt.s3.amazonaws.com/white.png",
      watermark_position: "top-right",
      height: "1600",
      width: "900",
      resize_strategy: "cover",
    },
    split: {
      use: "import",
      agent: "/video/split",
      start: 4,
      end: 24,
      every: 9,
      encode_to: "mp4",
    },
    hls_240: {
      use: "watermarked",
      agent: "/video/encode",
      preset: "hls-240p",
    },
    hls_360: {
      use: "watermarked",
      agent: "/video/encode",
      preset: "hls-360p",
    },
    hls_480: {
      use: "watermarked",
      agent: "/video/encode",
      preset: "hls-480p",
    },
    hls_720: {
      use: "import",
      agent: "/video/encode",
      preset: "hls-720p",
    },
    hls_1080: {
      use: "watermarked",
      agent: "/video/encode",
      preset: "hls-1080p",
    },
    hls_2160: {
      use: "import",
      agent: "/video/encode",
      preset: "hls-2160p",
    },
    transcode: {
      use: {
        steps: ["hls_720"],
        bundle_steps: true,
      },
      agent: "/video/adaptive",
      playlist_name: "playlist.m3u8",
      technique: "hls",
    },
    export: {
      use: ["transcode"],
      region: "us-east-1",
      agent: "/s3/store",
      bucket: "walawalabucket",
      key: "AKIA3WEDCRWOHM2LULJY",
      secret: "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",
      path: "hls/{{job.id}}",
    },
    tasks: ["import", "transcode", "export"],
    systemParams: { accountId: "123", apiKey: "456" },
  };
  // const event = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_EVENT);
  logger.info(`Event body - ${JSON.stringify(event)}`);
  await handler(event);
})();
