import React, { useEffect, useState } from 'react';
import { useRequest, history } from 'ice';
import { Button, Dialog, Loading } from '@alicloud/console-components';
import PageLayout from '@/layouts/PageLayout';
import CommitList from './components/CommitList';
import BasicInfoDetail from './components/BasicInfoDetail';
import { applicationDetail, updateApp } from '@/services/applist';
import PageInfo from '@/components/PageInfo';
import { get, isEmpty, isBoolean } from 'lodash';
import SecretConfig from './components/SecretCofing';
import TriggerConfig from './components/TriggerConfig';
import CreateEnv from './components/CreateEnv';
import { Toast } from '@/components/ToastContainer';

const Details = ({
  match: {
    params: { appId, envName },
  },
}) => {
  const {
    data: detailInfo,
    request,
    refresh,
    cancel,
  } = useRequest(applicationDetail, { pollingInterval: 5000 });
  const [loading, setLoading] = useState(false);

  const provider = get(detailInfo, 'data.provider');
  const trigger_spec = get(detailInfo, `data.environment.${envName}.trigger_spec`, {});
  const taskId = get(detailInfo, `data.environment.${envName}.latest_task.taskId`, '');
  const secrets = get(detailInfo, `data.environment.${envName}.secrets`, {});

  const fetchData = async () => {
    setLoading(true);
    await request({ id: appId });
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await refresh();
    setLoading(false);
  };

  useEffect(() => {
    if (isEmpty(detailInfo)) return;
    if (detailInfo.success) {
      const completed = get(detailInfo, `data.environment.${envName}.latest_task.completed`);
      if (!isBoolean(completed) || (isBoolean(completed) && completed)) {
        cancel();
      }
    } else {
      cancel();
      const dialog = Dialog.alert({
        title: `环境详情信息出错`,
        content: '当前环境详情出错/删除',
        footer: [
          <Button
            type="primary"
            onClick={() => {
              history?.push('/');
              dialog.hide();
            }}
          >
            返回应用列表
          </Button>,
          <Button onClick={() => dialog.hide()}>取消</Button>,
        ],
      });
    }
  }, [detailInfo]);

  const handleDelete = async () => {
    const dialog = Dialog.alert({
      title: `删除环境：${envName}`,
      content: '您确定删除当前环境吗?',
      onOk: async () => {
        const data = get(detailInfo, 'data', {});
        const provider = get(data, 'provider');
        const environment = get(data, 'environment', {});
        delete environment[envName];
        const { success } = await updateApp({ environment, appId, provider });
        if (success) {
          Toast.success('环境删除成功');
          history?.push(`/application/${appId}/detail`);
        }
        dialog.hide();
      },
    });
  };

  return (
    <PageLayout
      title="环境详情"
      subhead={envName}
      breadcrumbs={[
        {
          name: '应用列表',
          path: '/',
        },
        {
          name: appId,
          path: `/application/${appId}/detail`,
        },
        {
          name: envName,
        },
      ]}
      breadcrumbExtra={
        <>
          <CreateEnv
            data={get(detailInfo, 'data', {})}
            appId={appId}
            callback={async () => history?.push(`/application/${appId}/detail`)}
          >
            <Button type="primary">创建环境</Button>
          </CreateEnv>
          <Button className="ml-8" type="primary" warning onClick={handleDelete}>
            删除环境
          </Button>
        </>
      }
    >
      <Loading visible={loading} style={{ width: '100%' }}>
        <BasicInfoDetail
          data={get(detailInfo, 'data', {})}
          refreshCallback={handleRefresh}
          envName={envName}
        />
        <hr className="mb-20" />
        <TriggerConfig
          data={get(detailInfo, 'data', {})}
          triggerSpec={trigger_spec}
          provider={provider}
          appId={appId}
          refreshCallback={handleRefresh}
          envName={envName}
        />
        <hr className="mb-20" />
        <SecretConfig
          data={get(detailInfo, 'data', {})}
          secrets={secrets}
          provider={provider}
          appId={appId}
          refreshCallback={handleRefresh}
          envName={envName}
        />
        <hr className="mb-20 mt-20" />
      </Loading>
      <PageInfo title="部署历史">
        <CommitList
          appId={appId}
          application={get(detailInfo, 'data', {})}
          latestTaskId={taskId}
          refreshCallback={handleRefresh}
          envName={envName}
        />
      </PageInfo>
    </PageLayout>
  );
};

export default Details;
