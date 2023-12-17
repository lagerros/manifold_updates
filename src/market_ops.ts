import moment from "moment";
import { updateLocalMarket, updateLastSlackInfo, updateNewTrackedSlackInfo } from "./database";
import { getBets, getComments, getMarket, getUniquePositions } from "./manifold_api";
import { sendSlackMessage } from "./slack";
import { Market, TrackedMarket, Answer, probChangesType } from "./types";
import { formatProb, getJsonUrl, isTimeForNewUpdate } from "./util";
import { microDebugging, SLACK_ON, isDeploy, delta, channelId } from "./run_settings";

const getProbChange = async (contractId: string, t: number): Promise<number> => {
  const bets = await getBets(contractId);
  const recentBets = bets?.filter(bet => moment().diff(moment(bet.createdTime), 'hours') <= t);

  if (recentBets && recentBets.length > 0) {
    const firstBet = recentBets[0];
    const lastBet = recentBets[recentBets.length - 1];
    return firstBet.probBefore - lastBet.probAfter;
  }

  return 0;
};


const getCommentsNote = async (marketId: string, t: number): Promise<{commentsNote:string, num_comments:number}> => {
  const comments = await getComments(marketId, t);
  if (!comments) { return {commentsNote:"", num_comments:0} }
  const filteredComments = comments.filter(comment => !comment.replyToCommentId);
  const latestComments = filteredComments.slice(0, 3);

  const commentsNote = latestComments.map(comment => {
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

  return {commentsNote, num_comments: latestComments.length};
};

const getChangeReport = async (market: Market): Promise<{ reportWorthy: boolean, changeNote: string, commentsNote: string, num_comments: number, timeWindow: number }> => {
  const periods: ('day' | 'week' | 'month')[] = ['day', 'week', 'month'];
  const periodHours = { day: 24, week: 24 * 7, month: 24 * 30 };

  const calculateChangeAndNote = (change: number, period: 'day' | 'week' | 'month'): { direction: string, changeNote: string, time: number } => {
    if (Math.abs(change) <= delta) {
      return { direction: '', changeNote: '', time: 72 }
    } else {
      const direction = change > 0 ? ':chart_with_upwards_trend: Up' : ':chart_with_downwards_trend: Down';
      const changeNote = `${direction} ${formatProb(change)}% in the last ${period}`;
      const time = periodHours[period];
      return { direction, changeNote, time };
    }
  };

  const getProbChangesForPeriods = async (contractId: string) => {
    const probChanges = {
      day: await getProbChange(contractId, 24),
      week: await getProbChange(contractId, 24 * 7),
      month: await getProbChange(contractId, 24 * 7 * 4),
    };
    return probChanges;
  };

  const evaluateOutcomeType = async (market: Market | Answer, probChanges:probChangesType) => {
    
    const changes = periods.map(period => ({ ...calculateChangeAndNote(probChanges[period], period), period }));
    const significantChange = changes.find(change => change.changeNote !== '');
    return significantChange ? { reportWorthy: true, changeNote: significantChange.changeNote, commentTime: significantChange.time } : { reportWorthy: false, changeNote: '', commentTime: 72 };
  };

  const evaluateMarket = async (m: Market) => {
    switch (m.outcomeType) {
      case 'BINARY':
        const probChanges = await getProbChangesForPeriods(m.id);
        return evaluateOutcomeType(m, probChanges);
      case 'MULTIPLE_CHOICE':
        const reportNotes = await Promise.all(m.answers.map(async answer => {
          const probChanges = answer.probChanges ?? { day: 0, week: 0, month: 0 }
          const { reportWorthy, changeNote } = await evaluateOutcomeType(answer, probChanges);
          return reportWorthy ? `"${answer.text}": ${changeNote}.\n` : '';
        }));
        const significantReportNotes = reportNotes.filter(note => note !== '');
        return { reportWorthy: significantReportNotes.length > 0, changeNote: significantReportNotes.join(' '), commentTime: 72 };
      default:
        return { reportWorthy: false, changeNote: '', commentTime: 72 };
    }
  };

  const { reportWorthy, changeNote, commentTime } = await evaluateMarket(market);
  const { commentsNote, num_comments} = reportWorthy ? await getCommentsNote(market.id, commentTime) : {commentsNote:'', num_comments:0};
  return { reportWorthy, changeNote, commentsNote, num_comments, timeWindow: 24 };
};

const getMoreInfo = async (market: Market): Promise<string> => {
  const r = await getUniquePositions(market.id)
  let positionNote = '';
  if (r) {
    positionNote = (
    `:warning: (position data might be somewhat inaccurate)\n`+
    `:large_green_square: YES positions\n`+
    `${r.yesPositions.slice(0, 3).map(p => `--- ${p.userName}: :heavy_dollar_sign:${Math.round(p.shares)}`).join('\n')}\n`+
    `:large_red_square: NO positions:\n`+
    `${r.noPositions.slice(0, 3).map(p => `--- ${p.userName}: :heavy_dollar_sign:${Math.round(p.shares)}`).join('\n')}\n`
    )
  }
  return (
    `Total liquidity: :heavy_dollar_sign:${market.totalLiquidity}\n`+
    `Volume: :heavy_dollar_sign:${Math.round(market.volume24Hours)} (24h), :heavy_dollar_sign:${Math.round(market.volume)} (total)\n`+
    `Unique traders: ${market.uniqueBettorCount}\n\n`+
    `${positionNote}`
  )
}

export const checkAndSendUpdates = async (localMarkets: TrackedMarket[]): Promise<void> => {
  const fetchedMarkets = await Promise.all(localMarkets.map(m => getMarket(getJsonUrl(m.url))));
  if (!fetchedMarkets) return

  fetchedMarkets.forEach(async (fetchedMarket) => {
    if (!fetchedMarket) return;
    const localMarket = localMarkets.find(q => q.url === fetchedMarket.url);

    // Check if we're in isolated debug mode
    if (microDebugging.length > 0 && !microDebugging.includes(fetchedMarket.url)) {console.log("Ignoring due to microdebugging"); return}
    
    const { reportWorthy, changeNote, commentsNote, num_comments, timeWindow } = await getChangeReport(fetchedMarket);
    const isUpdateTime = !!localMarket && isTimeForNewUpdate(localMarket, timeWindow);
    const toSendReport = ((reportWorthy && isUpdateTime) || (!isDeploy && microDebugging.length > 0)) && SLACK_ON

    console.log(`Send report? ${toSendReport}! (reportWorthy ${reportWorthy}, SLACK_ON ${SLACK_ON}, microDebugging ${microDebugging.length > 0}, isTimeForNewUpdate ${isUpdateTime})`, changeNote, fetchedMarket.url, "\n");

    if (toSendReport) {
      const marketName = (fetchedMarket.outcomeType === "BINARY" ? `(${formatProb(fetchedMarket.probability)}%) ` : "") + fetchedMarket.question;
      const more_info = await getMoreInfo(fetchedMarket);
      const response = await sendSlackMessage({ url: fetchedMarket.url, market_name: marketName, market_id: fetchedMarket.id, report: changeNote+`${num_comments > 0 ? `\n(${num_comments} comments)` : ""}`, comments: commentsNote, channelId: channelId, more_info });
      if (response?.status === 200 && timeWindow) {
        // Slack message sent successfully, update database
        if (isDeploy) {
          await updateLastSlackInfo(fetchedMarket.url, timeWindow, changeNote);
        }
      }
    }
  });
};

export const checkForNewAdditions = async (localMarkets: TrackedMarket[]): Promise<void> => {
  const fetchedMarkets = await Promise.all(localMarkets.map(m => getMarket(getJsonUrl(m.url))));
  if (!fetchedMarkets) return
  
  fetchedMarkets.forEach(async (fm) => {
    if (!fm) return;
    const lm = localMarkets.find(q => q.url === fm.url);
    if (!!lm && !lm.last_track_status_slack_time && (microDebugging.length === 0 || microDebugging.includes(fm.url))) {
      console.log("new tracked market found", fm.url, "\n");

      if (SLACK_ON) {
        const response = await sendSlackMessage({ url: lm.url, market_name: ":seedling: "+fm.question, market_id: fm.id, report: ":eyes: Now tracking this market ^", channelId: channelId });
        if (response?.status === 200) {
          console.log("Messaged slack about new market addition, ", fm.question)
          if (isDeploy) {
            await updateNewTrackedSlackInfo(fm.url);
          }
        }
      }
    }
  })  
}
