import axios from "axios";
import dayjs from "dayjs";
import crypto from "crypto";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(process.env.TZ || "Asia/Shanghai");

const WORKFLOW_WEBHOOK =
  "https://open.feishu.cn/open-apis/bot/v2/hook/2a08d4d3-80aa-47ac-a2d0-03545e0b8bd9";
const WORKFLOW_WEBHOOK_SIGN_SECRET = "z4QB1WkLQosHLNdXSrsE7c";

const genSign = (secret: string) => {
  const timestamp = Math.round(Date.now() / 1000);
  const plainText = timestamp + "\n" + secret;
  const sign = crypto.createHmac("sha256", plainText).digest("base64");
  return { sign, timestamp };
};

const workflowMessage = async (
  pipelineInfo: {
    envName: string;
    author: string;
    startedAt: number;
    status: "success" | "failed" | "running" | "canceled";
    pipelineUrl: string;
    branch: string;
    sha?: string;
    commitMessage?: string;
  },
  title = "流水线运行通知",
) => {
  // NOTE: 卡片消息参考地址 https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot#4996824a
  const statusConfig: Record<
    string,
    { emoji: string; text: string; color: string; template: string }
  > = {
    success: { emoji: "✅", text: "成功", color: "green", template: "green" },
    failure: { emoji: "❌", text: "失败", color: "red", template: "red" },
    failed: { emoji: "❌", text: "失败", color: "red", template: "red" },
    running: { emoji: "⏳", text: "运行中", color: "blue", template: "blue" },
    canceled: { emoji: "🚫", text: "取消", color: "grey", template: "grey" },
    cancelled: { emoji: "🚫", text: "取消", color: "grey", template: "grey" },
    skipped: { emoji: "⏭️", text: "跳过", color: "grey", template: "grey" },
    timed_out: {
      emoji: "⏰",
      text: "超时",
      color: "orange",
      template: "orange",
    },
    neutral: { emoji: "⚪", text: "中性", color: "grey", template: "grey" },
    action_required: {
      emoji: "⚠️",
      text: "需要操作",
      color: "yellow",
      template: "yellow",
    },
  };
  const status = statusConfig[pipelineInfo.status];
  const shaStr = pipelineInfo.sha ? pipelineInfo.sha.slice(0, 7) : "-";

  const url = WORKFLOW_WEBHOOK;
  const secret = WORKFLOW_WEBHOOK_SIGN_SECRET;
  return await axios
    .post(url, {
      msg_type: "interactive",
      card: {
        header: {
          title: {
            content: `${status.emoji} ${title}`,
            tag: "lark_md",
          },
          template: status.template,
        },
        elements: [
          {
            tag: "column_set",
            flex_mode: "bisect",
            horizontal_spacing: "default",
            horizontal_align: "left",
            columns: [
              {
                tag: "column",
                width: "weighted",
                weight: 1,
                elements: [
                  {
                    tag: "markdown",
                    text_align: "left",
                    content: `**环境**: ${pipelineInfo.envName}`,
                  },
                  {
                    tag: "markdown",
                    text_align: "left",
                    content: `**分支**: ${pipelineInfo.branch}`,
                  },
                  {
                    tag: "markdown",
                    text_align: "left",
                    content: `**状态**: ${status.text}`,
                  },
                ],
              },
              {
                tag: "column",
                width: "weighted",
                weight: 1,
                elements: [
                  {
                    tag: "markdown",
                    text_align: "left",
                    content: `**作者**: ${pipelineInfo.author}`,
                  },
                  {
                    tag: "markdown",
                    text_align: "left",
                    content: `**SHA**: ${shaStr}`,
                  },
                  {
                    tag: "markdown",
                    text_align: "left",
                    content: `**开始时间**: ${dayjs
                      .unix(pipelineInfo.startedAt)
                      .tz()
                      .format("YYYY-MM-DD HH:mm:ss")}`,
                  },
                ],
              },
            ],
          },
          ...(pipelineInfo.commitMessage
            ? [
                {
                  tag: "div",
                  text: {
                    tag: "lark_md",
                    content: `**提交信息**: ${pipelineInfo.commitMessage}`,
                  },
                },
              ]
            : []),
          {
            actions: [
              {
                tag: "button",
                text: {
                  content: "点击查看流水线详情",
                  tag: "lark_md",
                },
                url: pipelineInfo.pipelineUrl,
                type: "primary",
                value: {},
              },
            ],
            tag: "action",
          },
        ],
      },
      ...genSign(secret),
    })
    .then((res) => {
      console.log("feishu request result: ", res.data);
      return res.data;
    })
    .catch((err) => console.error("feishu request error:", err));
};

const exec = async () => {
  const { context } = await import("@actions/github");
  const { runStartedAt } = process.env;

  let commitMessage: string | undefined;
  if (context.eventName === "push" && context.payload.head_commit) {
    commitMessage = context.payload.head_commit.message;
  } else if (
    (context.eventName === "pull_request" ||
      context.eventName === "pull_request_target") &&
    context.payload.pull_request
  ) {
    commitMessage = context.payload.pull_request.title;
  } else if (context.eventName === "release" && context.payload.release) {
    commitMessage =
      context.payload.release.name || context.payload.release.tag_name;
  }

  workflowMessage(
    {
      envName: context.payload.environment || "--",
      author: context.actor,
      startedAt: runStartedAt
        ? dayjs(runStartedAt).unix()
        : Math.floor(Date.now() / 1000),
      status: (process.env.STATUS as any) || "running",
      pipelineUrl: `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
      branch: context.ref.replace("refs/heads/", ""),
      sha: context.sha,
      commitMessage: commitMessage,
    },
    context.workflow,
  );
};
exec().catch((err) => {
  console.error("catch error: ", err);
});
