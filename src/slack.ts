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
    const webhook = process.env['SLACK_MAIN_WEBHOOK']
    if (webhook) {
      const response = await axios.post(webhook, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response
    }
  } catch (error: any) {
    console.error(`Error occurred while sending Slack message: ${JSON.stringify(error.response.data)}`);
  }
};

// TODO: make this the main slack function
export const sendDevSlackUpdate = async (webhook:string, payload:{message:string, channelId:string}) => {
  try {
    const response = await axios.post(webhook, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response
  } catch (error: any) {
    console.error(`Error occurred while sending Slack message: ${JSON.stringify(error.response.data)}`);
  }
}