import axios from 'axios';
import moment from 'moment';

interface Bet {
  createdTime: string;
  probBefore: number;
  probAfter: number;
}

interface Answer {
  createdTime: number;
  avatarUrl: string;
  id: string;
  username: string;
  number: number;
  name: string;
  contractId: string;
  text: string;
  userId: string;
  probability: number;
}

interface Market {
  id: string;
  creatorUsername: string;
  creatorName: string;
  createdTime: number;
  creatorAvatarUrl: string;
  closeTime: number;
  question: string;
  description: string;
  url: string;
  pool: null;
  outcomeType: string;
  mechanism: string;
  volume: number;
  volume24Hours: number;
  isResolved: boolean;
  resolution: string;
  resolutionTime: number;
  answers: Answer[];
}

const getMarkets = async (): Promise<Market[]> => {
  const response = await axios.get('https://manifold.markets/api/v0/markets?limit=10');
  return response.data;
};

const getBets = async (marketId: string): Promise<Bet[]> => {
  const response = await axios.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
  return response.data;
};

const sendSlackMessage = async (url: string, marketName: string, marketId: string, report: string): Promise<void> => {
  const payload = {
    url,
    market_name: marketName,
    market_id: marketId,
    report,
  };

  await axios.post('https://hooks.slack.com/triggers/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', payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

const checkBets = async (): Promise<void> => {
  const markets = await getMarkets();

  for (const market of markets) {
    const bets = await getBets(market.id);
    const recentBets = bets.filter(bet => moment().diff(moment(bet.createdTime), 'hours') <= 24);

    if (recentBets.length > -10) {
      const firstBet = recentBets[0];
      const lastBet = recentBets[recentBets.length - 1];

      if (Math.abs(firstBet.probBefore - lastBet.probAfter) > 0.1) {
        await sendSlackMessage(market.url, market.question, market.id, 'The probability difference is more than 0.1');
      }
    }
  }
};

checkBets()
