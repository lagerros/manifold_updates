import { sendDevSlackUpdate } from "./slack.js";
import { devAlertsChannelId, devWebhook, isDeploy } from "./run_settings.js";
import chalk from "chalk";

export const slackConsoleError = (message: any) => {
  console.error(chalk.red(message));
  if (devWebhook && isDeploy) {
    // Only send errors to slack in production
    sendDevSlackUpdate(devWebhook, { channelId: devAlertsChannelId, message });
  }
};

export const listenAndSendErrorsToSlack = async () => {
  process.on("uncaughtException", (error) => {
    slackConsoleError(`Uncaught Exception: ${error}`);
  });

  process.on("unhandledRejection", async (reason, promise) => {
    const promiseResult = JSON.stringify(await promise);
    const message = `Unhandled Rejection at: ${promiseResult} reason: ${reason}`;
    slackConsoleError(message);
  });
};

export const systemHealthUpdate = async (): Promise<void> => {
  if (devWebhook) {
    await sendDevSlackUpdate(devWebhook, {
      channelId: devAlertsChannelId,
      message: `Bot still running (${
        isDeploy ? " :tophat: production" : " :computer: dev"
      }). :white_check_mark:`,
    });
  }
};

export const systemStartUpdate = async (): Promise<void> => {
  if (devWebhook) {
    await sendDevSlackUpdate(devWebhook, {
      channelId: devAlertsChannelId,
      message: `Bot restarted (${
        isDeploy ? " :tophat: production" : " :computer: dev"
      })`,
    });
  }
};
