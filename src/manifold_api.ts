import axios from "axios";
import { Bet, FetchedMarket, Comment, Position, Mover, MoveStats, AggregateMove, LocalMarket } from "./types";
import moment from "moment";
import { getJsonUrl, ignoreDueToMicroDebugging } from "./util";
import { isDeploy } from "./run_settings";

export const getMarket = async (url: string): Promise<FetchedMarket|undefined> => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting market: ${error}`);
  }
}

export const getMarkets = async (): Promise<FetchedMarket[]|undefined> => {
  try {
    const response = await axios.get('https://manifold.markets/api/v0/markets?limit=10');
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting markets: ${error}`);
  }
};

export const getComments = async (marketId: string, t: number): Promise<Comment[]|undefined> => {
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/comments?contractId=${marketId}`);
    const allComments:Comment[] = response.data;
  
    const recentComments = allComments.filter(comment => moment().diff(moment(comment.createdTime), 'hours') <= t);
    return recentComments;
  } catch (error) {
    console.error(`Error occurred while getting comments: ${error}`);
  }
};

export const getBets = async (marketId: string, t?: number): Promise<Bet[]|undefined> => {
  // TODO: handle yes/no outcomes
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
    let bets: Bet[] = response.data;
    
    bets = bets.filter(bet => bet.isFilled && !bet.isCancelled);

    if (!!t) {
      bets = bets.filter(bet => moment().diff(moment(bet.createdTime), 'hours') <= t);
    }
  
    return bets;
  } catch (error) {
    console.error(`Error occurred while getting bets: ${error}`);
  }
};

export const getPositions = async (marketId: string): Promise<Position[]|undefined> => {
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting positions: ${error}`);
  }
};

export const getUniquePositions = async (marketId: string): Promise<{ yesPositions: Position[], noPositions: Position[] }|undefined> => {
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
    const data: Position[] = response.data;
    // Filter out unique positions by the latest createdTime per userUsername
    const uniquePositions = data.reduce((acc: Record<string, Position>, position: Position) => {
      const { userUsername, createdTime } = position;
      if (!userUsername) return acc;
      if (!acc[userUsername] || acc[userUsername].createdTime < createdTime) {
        acc[userUsername] = position;
      }
      return acc;
    }, {});
    // Convert the record back into an array
    const uniquePositionsArray = Object.values(uniquePositions);
    // Group positions into YES and NO arrays and sort them by shares
    const yesPositions = uniquePositionsArray
      .filter(position => position.outcome === 'YES')
      .sort((a, b) => b.shares - a.shares);
    const noPositions = uniquePositionsArray
      .filter(position => position.outcome === 'NO')
      .sort((a, b) => b.shares - a.shares);
    return { yesPositions, noPositions };
  } catch (error) {
    console.error(`Error occurred while getting positions: ${error}`);
  }
};

const getPercentileEffect = (effectSize: number, movers: Mover[], totalMove: number): number => {
  let cumulativeProbChange = 0;
  let moversCount = 0;
  for (const mover of movers) {
    cumulativeProbChange += Math.abs(mover.probChangeTotal);
    moversCount++;
    if (cumulativeProbChange >= Math.abs(totalMove) * effectSize) {
      break;
    }
  }
  return moversCount / movers.length;
};

export const getAggregateMoveData = async (marketId: string, t: number): Promise<{move:AggregateMove, counterMove:AggregateMove}|undefined> => {
  const bets = await getBets(marketId, t)
  if (!bets || !bets.length) return;
  const totalChange = bets[0].probAfter - bets[bets.length - 1].probBefore;
  let totalMove = 0;
  let totalCounterMove = 0;
  
  const userBets = bets.reduce((acc: Record<string, Mover>, bet) => {
    const probChange = bet.probAfter - bet.probBefore;
    if (!acc[bet.userId]) {
      acc[bet.userId] = {
        userId: bet.userId,
        probChangeTotal: 0,
        userName: bet?.userName,
        numBets: 0,
        probChanges: []
      };
    }
    acc[bet.userId].probChangeTotal += probChange;
    acc[bet.userId].numBets += 1;
    acc[bet.userId].probChanges.push(probChange);
    return acc;
  }, {});
  
  const movers: Mover[] = [];
  const counterMovers: Mover[] = [];

  for (const userId in userBets) {
    const mover = userBets[userId];
    
    if (Math.sign(mover.probChangeTotal) === Math.sign(totalChange)) {
      movers.push(mover);
      totalMove += mover.probChangeTotal;
    } else {
      counterMovers.push(mover);
      totalCounterMove += mover.probChangeTotal;
    }
  }
  
  const getResponsibleShare = (mover: Mover, total: number) => total !== 0 ? mover.probChangeTotal / total : 0;
  movers.forEach(getResponsibleShare);
  counterMovers.forEach(getResponsibleShare);
  
  const byProbChange = (a: Mover, b: Mover) => Math.abs(b.probChangeTotal) - Math.abs(a.probChangeTotal);
  movers.sort(byProbChange);
  counterMovers.sort(byProbChange);

  return { 
    move: {
      movers, 
      stats: {
        moveSize: totalMove,
        effect20cohort: getPercentileEffect(0.2, movers, totalMove),
        effect50cohort: getPercentileEffect(0.5, movers, totalMove),
        effect80cohort: getPercentileEffect(0.8, movers, totalMove),
        top3moversEffect: movers.slice(0, 3).reduce((sum, mover) => sum + mover.probChangeTotal, 0) / totalMove
      }}, 
    counterMove: {
      movers: counterMovers, 
      stats: {
        moveSize: totalCounterMove,
        effect20cohort: getPercentileEffect(0.2, counterMovers, totalCounterMove),
        effect50cohort: getPercentileEffect(0.5, counterMovers, totalCounterMove),
        effect80cohort: getPercentileEffect(0.8, counterMovers, totalCounterMove),
        top3moversEffect: counterMovers.slice(0, 3).reduce((sum, mover) => sum + mover.probChangeTotal, 0) / totalCounterMove
      }
    } 
  };
}

export const fetchCorrespondingMarkets = async (localMarkets: LocalMarket[]): Promise<{fetchedMarket: FetchedMarket, localMarket: LocalMarket}[]> => {
  const markets = await Promise.all(
    localMarkets
      .filter(lm => isDeploy || !ignoreDueToMicroDebugging(lm.url))
      .map(async lm => ({fetchedMarket: await getMarket(getJsonUrl(lm.url)), localMarket: lm}))
  );
  return markets.filter(({fetchedMarket}): boolean => fetchedMarket !== undefined) as {fetchedMarket: FetchedMarket, localMarket: LocalMarket}[];
};
