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
  const event = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_EVENT);
  await handler(event);
})();
