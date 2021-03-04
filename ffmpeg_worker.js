const { workerData, parentPort } = require("worker_threads");
const execa = require("execa");

const runFfmpeg = (data) => {
  execa(data.cmd, data.args)
    .then(() => {
      parentPort.postMessage("done");
    })
    .catch((err) => {
      parentPort.postMessage(err);
    });
};

runFfmpeg(workerData);
