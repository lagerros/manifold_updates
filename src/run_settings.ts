export const microDebugging:string[] = [] 
export const isDeploy = process.env[`IS_DEPLOY`] === `true`;


// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// User settings
export const SLACK_ON = isDeploy || false;
export const delta = 0.1 // The threshold we use for when to report a change
export const prodChannelId = "C069HTSPS69"
export const devAlertsChannelId = "C06ACLAUTDE"
export const devTestingChannelId = "C06D0T6853J"

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

export const channelId = isDeploy ? prodChannelId : devTestingChannelId;
export const mainWebhook = process.env[`SLACK_MAIN_WEBHOOK`]
export const devWebhook = process.env[`SLACK_DEV_CHANNEL_WEBHOOK`]