import axios from "axios";
import { Bet, Market, Comment, Position } from "./types";
import moment from "moment";

export const getMarket = async (url: string): Promise<Market|undefined> => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error occurred while getting market: ${error}`);
  }
}

export const getMarkets = async (): Promise<Market[]|undefined> => {
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

export const getBets = async (marketId: string): Promise<Bet[]|undefined> => {
  try {
    const response = await axios.get(`https://manifold.markets/api/v0/bets?contractId=${marketId}`);
    return response.data;
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