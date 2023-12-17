export const microDebugging:string[] = ["https://manifold.markets/EliezerYudkowsky/is-lecun-right-that-opensource-ai-w", "https://manifold.markets/ZviMowshowitz/will-google-have-the-best-llm-by-eo-b4ad29f8b98d"] 
export const SLACK_ON = false;
export const isDeploy = process.env[`IS_DEPLOY`] === `true`;
export const delta = 0.1 // The threshold we use for when to report a change
export const channelId = isDeploy ? "C069HTSPS69" : "C06ACLAUTDE";