import axios from 'axios';
import moment from 'moment';
import { Client } from 'pg';

const client = new Client({
  connectionString: process.env['DATABASE_URL'],
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect(err => {
  if (err) {
    console.error('Failed to connect to the database!', err.stack);
  } else {
    console.log('Successfully connected to the database.');
    // Here you can proceed to execute queries on the database
  }
});

const SLACK_ON = true;

interface TrackedMarket {
  _id: string, 
  url: string, 
  lastslacktime?: Date,
  lastslackhourwindow?: number,
  tracked: boolean,
  last_report_sent?: string
}

interface Bet {
  createdTime: string;
  probBefore: number;
  probAfter: number;
}

interface Answer {
  id: string;
  text: string;
  index: number;
  userId: string;
  isOther: boolean;
  textFts: string;
  contractId: string;
  createdTime: number;
  probChanges?: {
    day: number;
    week: number;
    month: number;
  };
  subsidyPool: number;
  fsUpdatedTime: string;
  totalLiquidity: number;
  pool: {
    YES: number;
    NO: number;
  };
  probability: number;
}

interface MultipleChoiceMarket {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorName: string;
  createdTime: number;
  creatorAvatarUrl: string;
  closeTime: number;
  question: string;
  slug: string;
  url: string;
  totalLiquidity: number;
  outcomeType: "MULTIPLE_CHOICE";
  mechanism: string;
  volume: number;
  volume24Hours: number;
  isResolved: boolean;
  uniqueBettorCount: number;
  lastUpdatedTime: number;
  lastBetTime: number;
  answers: Answer[];
  description: {
    type: string;
    content: any[];
  };
  groupSlugs: string[];
  textDescription: string;
}

interface BinaryMarket {
  id: string;
  creatorId: string;
  creatorUsername: string;
  creatorName: string;
  createdTime: number;
  creatorAvatarUrl: string;
  closeTime: number;
  question: string;
  slug: string;
  url: string;
  pool: {
    NO: number;
    YES: number;
  };
  probability: number;
  p: number;
  totalLiquidity: number;
  outcomeType: "BINARY";
  mechanism: string;
  volume: number;
  volume24Hours: number;
  isResolved: boolean;
  uniqueBettorCount: number;
  lastUpdatedTime: number;
  lastBetTime: number;
  description: {
    type: string;
    content: any[];
  };
  groupSlugs: string[];
  textDescription: string;
}

type Market = MultipleChoiceMarket | BinaryMarket;

type ParagraphContent = {
  type: "paragraph";
  content: {
    text: string;
    type: string;
  }[];
};

type IframeContent = {
  type: "iframe";
  attrs: {
    src: string;
    frameBorder: number;
  };
};

type ContentItem = ParagraphContent | IframeContent;


type Comment = {
  id: string;
  isApi: boolean;
  userId: string;
  content: {
    type: string;
    content: ContentItem[];
  };
  userName: string;
  contractId: string;
  visibility: string;
  commentType: string;
  createdTime: number;
  contractSlug: string;
  userUsername: string;
  userAvatarUrl: string;
  contractQuestion: string;
  replyToCommentId?: string;
  commenterPositionProb?: number;
  commenterPositionShares?: number;
  commenterPositionOutcome?: string;
  commentId: string;
  betId?: string;
  likes?: number;
  betAmount?: number;
  betOutcome?: string;
  editedTime?: number;
};

interface BinaryMarketWithProbChanges extends BinaryMarket {
  probChanges: {
    day: number;
    week: number;
    month: number;
  };
}

const fetchTrackedQuestions = async (): Promise<TrackedMarket[]> => {
  const queryText = 'SELECT _id, url, lastslacktime, lastslackhourwindow, tracked FROM markets WHERE tracked = true';
  try {
    const res = await client.query(queryText);
    const trackedMarkets: TrackedMarket[] = res.rows.map(row => ({
      _id: row._id,
      url: row.url,
      lastslacktime: row.lastslacktime,
      lastslackhourwindow: row.lastslackhourwindow,
      tracked: row.tracked
    }));
    return trackedMarkets;
  } catch (error) {
    console.error('Error fetching tracked questions', error);
    throw error;
  }
};

const getJsonUrl = (url: string): string => {
  const urlObj = new URL(url);
  const slug = urlObj.pathname.split('/').pop();
  return `https://manifold.markets/api/v0/slug/${slug}`;
};
  
const getMarket = async (url: string): Promise<Market> => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting market: ${error}`);
    throw error;
  }
}

const getMarkets = async (): Promise<Market[]> => {
  try {
    const response = await axios.get('https://manifold.markets/api/v0/markets?limit=10');
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting markets: ${error}`);
    throw error;
  }
};

const getComments = async (marketId: string, t: number): Promise<Comment[]> => {
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/comments?contractId=${marketId}`);
    const allComments:Comment[] = response.data;
  
    const recentComments = allComments.filter(comment => moment().diff(moment(comment.createdTime), 'hours') <= t);
    return recentComments;
  } catch (error) {
    console.error(`Error occurred while getting comments: ${error}`);
    throw error;
  }
};

const getBets = async (marketId: string): Promise<Bet[]> => {
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting bets: ${error}`);
    throw error;
  }
};

const updateLastSlackInfo = async (url: string, timeWindow: number): Promise<void> => {
  const queryText = `
    UPDATE markets
    SET lastSlackTime = NOW(), lastSlackHourWindow = $1
    WHERE url = $2
  `;
  try {
    await client.query(queryText, [timeWindow, url]);
    console.log('Updated lastSlackTime and lastSlackHourWindow in the database.');
  } catch (error) {
    console.error('Error updating lastSlackTime and lastSlackHourWindow in the database:', error);
  }
};

const sendSlackMessage = async (url: string, marketName: string, marketId: string, report: string, comments?:string, timeWindow?: number): Promise<void> => {
  const payload = {
    url,
    market_name: marketName,
    market_id: marketId,
    report,
    comments
  };

  try {
    const response = await axios.post('https://hooks.slack.com/triggers/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', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 200 && timeWindow) {
      // Slack message sent successfully, update database
      await updateLastSlackInfo(url, timeWindow);
    }
  } catch (error) {
    console.error(`Error occurred while sending Slack message: ${error}`);
  }
};

const getProbChange = async (contractId: string, t: number): Promise<number> => {
  const bets = await getBets(contractId);
  const recentBets = bets.filter(bet => moment().diff(moment(bet.createdTime), 'hours') <= t);
  
  if (recentBets.length > 0) {
    const firstBet = recentBets[0];
    const lastBet = recentBets[recentBets.length - 1];
    return Math.abs(firstBet.probBefore - lastBet.probAfter);
  }
  
  return 0;
};

const formatProb = (prob: number): string => Math.round(prob * 100).toString();

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

// TODO: move commentTime and timeWindow into same variable? 
const getChangeReport = async (market: Market): Promise<{reportWorthy: boolean, changeNote: string, commentsNote: string, timeWindow: number}> => {
  let reportWorthy = false;
  let changeNote = '';
  let commentsNote = '';
  let timeWindow = 24;
  let commentTime = 72; // default value
  const delta = 0.02
  
  const getDirectionAndNote = (change: number, period: string): { direction: string, changeNote: string, time: number } => {
    let direction = '';
    let changeNote = '';
    let time = 72;
    if (change > delta) {
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
      commentTime = dayNote ? dayTime : weekNote ? weekTime : monthTime;
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
        commentTime = dayNote ? dayTime : weekNote ? weekTime : monthTime;
      }
    }

    changeNote = reportNotes.join(' ');
  }
  
  if (reportWorthy) {
    commentsNote = await getCommentsNote(market.id, commentTime);
  }

  return { reportWorthy, changeNote, commentsNote, timeWindow };
};

const updateLocalMarket = async (id: string, lastslacktime: Date, lastslackhourwindow: number, last_report_sent: string): Promise<void> => {
  const queryText = `
    UPDATE markets
    SET lastslacktime = $1, lastslackhourwindow = $2, last_report_sent = $3
    WHERE _id = $4
    `
  try {
    await client.query(queryText, [lastslacktime, lastslackhourwindow, last_report_sent, id]);
    console.log('Local market updated in the database.');
  } catch (error) {
    console.error('Error updating local market in the database:', error);
  }
};

const checkAndSendUpdates = async (localMarkets:TrackedMarket[]): Promise<void> => {
  const fetchedMarkets = await Promise.all(localMarkets.map(q => getMarket(getJsonUrl(q.url)))); // todo: this is silly, fix
  
  for (const fetchedMarket of fetchedMarkets) {
    const localMarket = localMarkets.find(q => q.url === fetchedMarket.url);
    const { reportWorthy, changeNote, commentsNote, timeWindow } = await getChangeReport(fetchedMarket);
    const isTimeForNewUpdate = !!localMarket && (!localMarket.lastslacktime ? true : ((Date.now() - new Date(localMarket.lastslacktime).getTime()) > (timeWindow * 60 * 60 * 1000))) 
    const toSendReport = (reportWorthy && SLACK_ON && isTimeForNewUpdate)
    
    console.log("Send report? ", toSendReport, changeNote, fetchedMarket.url)

    if (toSendReport) {
      const marketName = (fetchedMarket.outcomeType === "BINARY" ? `(${formatProb(fetchedMarket.probability)}%) ` : "") + fetchedMarket.question
      await sendSlackMessage(fetchedMarket.url, marketName, fetchedMarket.id, changeNote, commentsNote);
      updateLocalMarket(localMarket._id, new Date(), timeWindow, changeNote) 
    } 
  }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const loop = async () => {
  while (true) {
    try {
      const questions = await fetchTrackedQuestions();
      await checkAndSendUpdates(questions);
    } catch (error) {
      console.error(error);
    }
    await sleep(60 * 60 * 1000); // 10 seconds delay before proceeding to the next iteration of the loop
  }
};

loop(); // assume takes 1 second to run

