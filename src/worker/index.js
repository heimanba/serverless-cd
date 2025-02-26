const path = require('path');
const core = require('@serverless-cd/core');
const {
  DOMAIN,
  REGION,
  DOWNLOAD_CODE_DIR: execDir,
  CD_PIPELINE_YAML,
  CREDENTIALS,
  OSS_CONFIG,
  DEFAULT_UNSET_ENVS,
} = require('@serverless-cd/config');

const checkout = require('@serverless-cd/git').default;
const Setup = require('@serverless-cd/setup-runtime').default;
const Engine = require('@serverless-cd/engine').default;

const _ = core.lodash;
const { getPayload, getOTSTaskPayload } = require('./utils');
const { updateAppById, makeTask } = require('./model');

async function handler(event, _context, callback) {
  // 解析入参
  const inputs = getPayload(event);
  console.log(JSON.stringify(inputs, null, 2));
  const {
    taskId,
    provider,
    cloneUrl,
    pusher,
    authorization: { userId, owner, appId, accessToken: token, secrets } = {},
    ref,
    commit,
    message,
    branch,
    tag,
    event_name,
    customInputs = {},
    environment = {},
    envName,
  } = inputs;

  const cwdPath = path.join(execDir, taskId);
  const logPrefix = `/logs/${taskId}`;
  core.fs.emptyDirSync(logPrefix);
  console.log('start task, uuid: ', taskId);

  const appTaskConfig = { taskId, commit, message, ref };

  const getEnvData = (context) => ({
    ...appTaskConfig,
    completed: context.completed,
    status: context.status,
  });

  // 拉取代码
  const onInit = async (context, logger) => {
    logger.info('onInit: checkout start');
    logger.debug(`start checkout code, taskId: ${taskId}`);
    await checkout({
      token,
      provider,
      logger,
      owner,
      clone_url: cloneUrl,
      execDir: cwdPath,
      ref,
      commit,
    });
    logger.info('checkout success');

    // 解析 pipeline
    const pipLineYaml = path.join(cwdPath, CD_PIPELINE_YAML);
    logger.info(`parse spec: ${pipLineYaml}`);
    const pipelineContext = core.parseSpec(pipLineYaml);
    logger.debug(`pipelineContext:: ${JSON.stringify(pipelineContext)}`);
    const steps = _.get(pipelineContext, 'steps');
    logger.debug(`parse spec success, steps: ${JSON.stringify(steps)}`);
    logger.debug(`start update app`);
    environment[envName].latest_task = getEnvData(context);
    logger.info(`update app in engine onInit: ${JSON.stringify(environment)}`);
    await updateAppById(appId, { environment });
    logger.debug(`start update app success`);

    const runtimes = _.get(pipelineContext, 'runtimes', []);
    logger.info(`start init runtime: ${runtimes}`);
    const setup = new Setup({
      runtimes,
      credentials: CREDENTIALS,
      region: REGION,
    });
    await setup.run();
    logger.info(`init runtime success`);

    return { steps };
  };

  // 启动 engine
  const engine = new Engine({
    cwd: cwdPath,
    logConfig: {
      logPrefix,
      ossConfig: {
        ...CREDENTIALS,
        ...OSS_CONFIG,
      },
      // logLevel: 'debug',
    },
    inputs: {
      ...customInputs,
      task: {
        id: taskId,
        url: DOMAIN ? `${DOMAIN}/application/${userId}/detail/${envName}/${taskId}` : '',
      },
      app: {
        // 应用的关联配置
        user_id: userId,
        id: appId,
      },
      secrets,
      git: {
        // git 相关的内容
        owner,
        provider, // 托管仓库
        clone_url: cloneUrl, // git 的 url 地址
        ref,
        commit,
        branch,
        message,
        tag,
        event_name, // 触发的事件名称
        pusher,
      },
    },
    events: {
      onInit,
      onPreRun: async function (_data, context) {
        await makeTask(taskId, {
          status: context.status,
          steps: getOTSTaskPayload(context.steps),
        });
      },
      onPostRun: async function (_data, context) {
        await makeTask(taskId, {
          status: context.status,
          steps: getOTSTaskPayload(context.steps),
        });
      },
      onCompleted: async function (context, logger) {
        await makeTask(taskId, {
          status: context.status,
          steps: getOTSTaskPayload(context.steps),
        });
        environment[envName].latest_task = getEnvData(context);
        logger.info(`onCompleted environment: ${JSON.stringify(environment)}`);
        await updateAppById(appId, { environment });
        logger.info('completed end.');
        callback(null, '');
      },
    },
    unsetEnvs: DEFAULT_UNSET_ENVS,
  });

  console.log('init task');
  await makeTask(taskId, {
    env_name: envName,
    user_id: userId,
    app_id: appId,
    status: engine.context.status,
    trigger_payload: inputs,
  });
  environment[envName].latest_task = getEnvData(engine.context);
  console.log('App update environment', JSON.stringify(environment));
  // 防止有其他的动作，将等待状态也要set 到表中
  await updateAppById(appId, { environment });
  console.log('engine run start');
  await engine.start();
}

exports.handler = handler;
