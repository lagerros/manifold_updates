export const getJsonUrl = (url: string): string => {
  const urlObj = new URL(url);
  const slug = urlObj.pathname.split('/').pop();
  return `https://manifold.markets/api/v0/slug/${slug}`;
};

export const formatProb = (prob: number): string => Math.round(prob * 100).toString();

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));