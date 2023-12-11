import moment from "moment";
import {updateLocalMarket} from "./database";
import {getBets, getComments, getMarket} from "./manifold_api";
import {sendSlackMessage} from "./slack";
import {BinaryMarketWithProbChanges, Market, TrackedMarket} from "./types";
import {formatProb, getJsonUrl} from "./util";

const SLACK_ON = true;
const isDeploy = process.env[`IS_DEPLOY`] === `true`;

const getProbChange = async (contractId: string, t: number): Promise<number> => {
  const bets = await getBets(contractId);
  const recentBets = bets.filter(bet => moment().diff(moment(bet.createdTime), 'hours') <= t);
  
  if (recentBets.length > 0) {
    const firstBet = recentBets[0];
    const lastBet = recentBets[recentBets.length - 1];
    return firstBet.probBefore - lastBet.probAfter;
  }
  
  return 0;
};


const getCommentsNote = async (marketId: string, t: number): Promise<string> => {
  const comments = await getComments(marketId, t);
  const filteredComments = comments.filter(comment => !comment.replyToCommentId);
  const latestComments = filteredComments.slice(0, 3);
  
  const report = latestComments.map(comment => {
    const commentTexts = comment?.content?.content.map(contentItem => {
      if (contentItem.type === 'paragraph' && contentItem.content) {
        return contentItem?.content.map(textItem => textItem.text).join(' ');
      } else if (contentItem.type === 'iframe') {
        return `(link: ${contentItem.attrs.src})`;
      }
      return '';
    }).join(' ');
    
    if (commentTexts.length > 0) {
      const text = `:speech_balloon: ${comment.userName}: ${commentTexts.slice(0, 200)}${commentTexts.length > 200 ? '...' : ''}`;
      return text 
    } else {
      return ""
    }
  }).join('\n');

  return report;
};

const getChangeReport = async (market: Market): Promise<{reportWorthy: boolean, changeNote: string, commentsNote: string, timeWindow: number}> => {
  let reportWorthy = false;
  let changeNote = '';
  let commentsNote = '';
  let timeWindow = 24;
  const delta = 0.02
  
  const getDirectionAndNote = (change: number, period: string): { direction: string, changeNote: string, time: number } => {
    let direction = '';
    let changeNote = '';
    let time = 72;
    if (Math.abs(change) > delta) {
      direction = change > 0 ? ':chart_with_upwards_trend: Up' : ':chart_with_downwards_trend: Down';
      changeNote = `${direction} ${formatProb(change)}% in the last ${period}`;
      time = period === 'day' ? 24 : period === 'week' ? 24 * 7 : 24 * 30;
    }
    return { direction, changeNote, time };
  };

  if (market.outcomeType === 'BINARY') {
    const probChanges = {
      day: await getProbChange(market.id, 24),
      week: await getProbChange(market.id, 24 * 7),
      month: await getProbChange(market.id, 24 * 30),
    };

    const marketWithChanges: BinaryMarketWithProbChanges = { ...market, probChanges };
    
    if (probChanges.day > delta || probChanges.week > delta || probChanges.month > delta) {
      reportWorthy = true;
      let { changeNote: dayNote, time: dayTime } = getDirectionAndNote(probChanges.day, 'day');
      let { changeNote: weekNote, time: weekTime } = getDirectionAndNote(probChanges.week, 'week');
      let { changeNote: monthNote, time: monthTime } = getDirectionAndNote(probChanges.month, 'month');
      changeNote = dayNote || weekNote || monthNote;
      timeWindow = dayNote ? dayTime : weekNote ? weekTime : monthTime;
    }
  } 
  else if (market.outcomeType === 'MULTIPLE_CHOICE') {
    const reportNotes: string[] = [];

    for (const answer of market.answers) {
      let { probChanges } = answer;
      
      if (!probChanges) {
        probChanges = {
          day: await getProbChange(answer.contractId, 24), 
          week: await getProbChange(answer.contractId, 24 * 7),
          month: await getProbChange(answer.contractId, 24 * 30),
        }
      }
      
      if (probChanges.day > delta || probChanges.week > delta || probChanges.month > delta) {
        reportWorthy = true;
        let { changeNote: dayNote, time: dayTime } = getDirectionAndNote(probChanges.day, 'day');
        let { changeNote: weekNote, time: weekTime } = getDirectionAndNote(probChanges.week, 'week');
        let { changeNote: monthNote, time: monthTime } = getDirectionAndNote(probChanges.month, 'month');
        const reportNote = dayNote || weekNote || monthNote;
        reportNotes.push(`Answer "${answer.text}": `+ changeNote);
        timeWindow = dayNote ? dayTime : weekNote ? weekTime : monthTime;
      }
    }

    changeNote = reportNotes.join(' ');
  }
  
  if (reportWorthy) {
    commentsNote = await getCommentsNote(market.id, timeWindow);
  }

  return { reportWorthy, changeNote, commentsNote, timeWindow };
};

export const checkAndSendUpdates = async (localMarkets: TrackedMarket[]): Promise<void> => {
  const fetchedMarkets = await Promise.all(localMarkets.map(m => getMarket(getJsonUrl(m.url))));

  await Promise.all(fetchedMarkets.map(async (fetchedMarket) => {
    const localMarket = localMarkets.find(q => q.url === fetchedMarket.url);
    const { reportWorthy, changeNote, commentsNote, timeWindow } = await getChangeReport(fetchedMarket);
    const isTimeForNewUpdate = !!localMarket && (!localMarket.lastslacktime ? true : ((Date.now() - new Date(localMarket.lastslacktime).getTime()) > (timeWindow * 60 * 60 * 1000)))
    const toSendReport = reportWorthy && SLACK_ON && isTimeForNewUpdate;

    console.log("Send report? ", toSendReport, changeNote, fetchedMarket.url);

    const channelId = isDeploy ? "C069HTSPS69" : "C069C8Z94RY";

    if (toSendReport) {
      const marketName = (fetchedMarket.outcomeType === "BINARY" ? `(${formatProb(fetchedMarket.probability)}%) ` : "") + fetchedMarket.question;
      await sendSlackMessage(fetchedMarket.url, marketName, fetchedMarket.id, changeNote, commentsNote, channelId);
      updateLocalMarket(localMarket._id, new Date(), timeWindow, changeNote);
    }
  }));
};
