export const microDebugging:string[] = [] 
export const SLACK_ON = true;
export const isDeploy = process.env[`IS_DEPLOY`] === `true`;
export const delta = 0.1 // The threshold we use for when to report a change
export const channelId = isDeploy ? "C069HTSPS69" : "C06ACLAUTDE";