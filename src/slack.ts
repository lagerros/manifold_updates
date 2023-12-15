import axios from "axios";
import { updateLastSlackInfo } from "./database";

export const sendSlackMessage = async ({
  url,
  market_name,
  market_id,
  report,
  channelId,
  comments,
  timeWindow
}: {
  url: string;
  market_name: string;
  market_id: string;
  report: string;
  channelId: string;
  timeWindow: number;
  comments?: string;
}): Promise<void> => {
  const payload = {
    channelId,
    url,
    market_name,
    comments,
    market_id,
    report,
  };
  try {
    const response = await axios.post('https://hooks.slack.com/triggers/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', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 200 && timeWindow) {
      // Slack message sent successfully, update database
      const isDeploy = process.env[`IS_DEPLOY`] === `true`;
      if (isDeploy) {
        await updateLastSlackInfo(url, timeWindow, report);
      }
    }
  } catch (error: any) {
    console.error(`Error occurred while sending Slack message: ${JSON.stringify(error.response.data)}`);
  }
};