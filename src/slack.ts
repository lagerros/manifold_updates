import axios from "axios";

export const sendSlackMessage = async ({
  url,
  market_name,
  market_id,
  report,
  channelId,
  comments,
  more_info
}: {
  url: string;
  market_name: string;
  market_id: string;
  report: string;
  channelId: string;
  comments?: string;
  more_info?: string;
}): Promise<any> => {
  const payload = {
    channelId,
    url,
    market_name,
    comments,
    market_id,
    report,
    more_info
  };
  try {
    const response = await axios.post('https://hooks.slack.com/triggers/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', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response
  } catch (error: any) {
    console.error(`Error occurred while sending Slack message: ${JSON.stringify(error.response.data)}`);
  }
};