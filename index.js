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
require("dotenv").config();
const uuid = require("uuid");
const rimraf = require("rimraf");
const axios = require("axios");

const { size, sum, publisher } = require("./utils");
/** layer libs */
const { logger } = require("./logger");
const { Credentials } = require("aws-sdk");

const handler = async (body) => {
  logger.info("Started");
  let job = { id: uuid.v4() };
  let ecsMetaDataRes;
  let taskDetail;
  if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
    ecsMetaDataRes = await axios.get(
      `${process.env.ECS_CONTAINER_METADATA_URI_V4}/task`
    );
    logger.info(`ECS Docker Data - ${JSON.stringify(ecsMetaDataRes.data)}`);
    // get ecsId from from task ARN
    const taskParts = ecsMetaDataRes.data.TaskARN.split("/");
    const taskId = taskParts[taskParts.length - 1];
    job.id = taskId;

    taskDetail = {
      detail: {
        taskArn: ecsMetaDataRes.data.TaskARN,
        lastStatus: "PENDING",
        createdAt: ecsMetaDataRes.data.Containers[0].CreatedAt,
        overrides: {
          containerOverrides: [
            {
              environment: [],
            },
          ],
        },
      },
    };
  }

  try {
    let result = {};
    for (const task of body.tasks) {
      let taskDefination = body[task];
      logger.info(task);
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
    body.systemParams = {
      ...body.systemParams,
      usage: usgaeRes.reduce(sum),
      is_error: false,
    };

    if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
      logger.info(`ECS Data to Publish ${JSON.stringify(ecsMetaDataRes.data)}`);
      taskDetail.detail.lastStatus = "COMPLETED";
      taskDetail.detail.overrides.containerOverrides[0].environment[0] = {
        name: "env",
        value: JSON.stringify(body),
      };
      logger.info(`TaskDetail to Publish ${JSON.stringify(taskDetail)}`);
      await publisher(taskDetail);
      // await axios.post(body.notify_url);
    }

    logger.info(`Final Exit (Success) ${JSON.stringify(result)}`);

    // remove temp storage after the rendering is complete
    rimraf.sync(job.id);
    process.exit(0);
  } catch (error) {
    logger.error(`Final Exit (Failure) ${JSON.stringify(error)}`);
    body.systemParams = {
      ...body.systemParams,
      usage: 0,
      is_error: true,
      error_message: error.originalError
        ? error.originalError.message
        : error.message,
      error_code: error.code,
    };
    if (process.env.ECS_CONTAINER_METADATA_URI_V4) {
      logger.info(`ECS Data to Publish ${JSON.stringify(ecsMetaDataRes.data)}`);
      taskDetail.detail.lastStatus = "FAILED";
      taskDetail.detail.overrides.containerOverrides[0].environment[0] = {
        name: "env",
        value: JSON.stringify(body),
      };
      logger.info(`TaskDetail to Publish ${JSON.stringify(taskDetail)}`);
      await publisher(taskDetail);
    }
    // remove temp storage after the rendering is complete
    rimraf.sync(job.id);
    process.exit(1);
  }
};

(async () => {
  const event = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_EVENT);
  logger.info(`Event body - ${JSON.stringify(event)}`);
  await handler(event);
})();
