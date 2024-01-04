import { microDebugging, isDeploy } from "./run_settings";
import { LocalMarket, FetchedMarket } from "./types";

export const getJsonUrl = (url: string): string => {
  const urlObj = new URL(url);
  const slug = urlObj.pathname.split('/').pop();
  return `https://manifold.markets/api/v0/slug/${slug}`;
};

export const formatProb = (prob: number): string => Math.round(prob * 100).toString()+"%";

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const isTimeForNewUpdate = (localMarket:LocalMarket, timeWindow:number) => {
  console.log(localMarket.url, "last slack time: ", localMarket.lastslacktime, "timeWindow: ", timeWindow, timeWindow * 60 * 60 * 1000, "Date now: ", Date.now())
  if ( localMarket.lastslacktime ) {
    console.log( ", last date: ", (new Date(localMarket.lastslacktime).getTime()), "Date diff: ", (Date.now() - new Date(localMarket.lastslacktime).getTime())) 
  }
  return (!localMarket.lastslacktime ? true : ((Date.now() - new Date(localMarket.lastslacktime).getTime()) > (timeWindow * 60 * 60 * 1000)))
}

export const getName = (market: FetchedMarket): string => {
  return (market.outcomeType === "BINARY" ? `(${formatProb(market.probability)}) ` : "") + market.question;
};

export const getCorrespondingMarket = (market: FetchedMarket, localMarkets: LocalMarket[]): LocalMarket | undefined => {
  return localMarkets.find(q => q.url === market.url);
}

export const useMicrodebugging = (url:string):boolean => {
  return microDebugging.length > 0
}

export const ignoreDueToMicroDebugging = (url: string): boolean => { // TODO: fix, this logic is getting confusing
  return !useMicrodebugging(url) || (!microDebugging.includes(url) && !isDeploy);
}

