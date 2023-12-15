export const microDebugging = [] 
export const SLACK_ON = true;
export const isDeploy = process.env[`IS_DEPLOY`] === `true`;
export const delta = 0.1 // The threshold we use for when to report a change