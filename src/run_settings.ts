export const microDebugging:string[] = ["https://manifold.markets/JacobJacob/which-risk-categories-and-concepts"] 
export const isDeploy = process.env[`IS_DEPLOY`] === `true`;


// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// User settings
export const SLACK_ON = isDeploy || true;
export const delta = 0.1 // The threshold we use for when to report a change
export const prodChannelId = "C069HTSPS69"
export const devChannelId = "C06ACLAUTDE"

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------


export const channelId = isDeploy ? prodChannelId : devChannelId;
export const mainWebhook = process.env[`SLACK_MAIN_WEBHOOK`]
export const devWebhook = process.env[`SLACK_DEV_CHANNEL_WEBHOOK`]