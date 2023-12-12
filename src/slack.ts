import axios from "axios";
import {updateLastSlackInfo} from "./database";

export const sendSlackMessage = async (url: string, marketName: string, marketId: string, report: string, channelId: string, comments?:string, timeWindow?: number): Promise<void> => {
  const payload = {
    url,
    market_name: marketName,
    market_id: marketId,
    report,
    comments,
    channelId
  };

  try {
    const response = await axios.post('https://hooks.slack.com/triggers/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', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 200 && timeWindow) {
      // Slack message sent successfully, update database
      await updateLastSlackInfo(url, timeWindow, report);
    }
  } catch (error:any) {
    console.error(`Error occurred while sending Slack message: ${error.response.data}`);
  }
};