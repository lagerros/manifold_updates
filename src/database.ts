import { Client } from 'pg';
import { TrackedMarket } from './types';


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

export const fetchTrackedQuestions = async (): Promise<TrackedMarket[]|undefined> => {
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
  }
};

export const updateLastSlackInfo = async (url: string, timeWindow: number, last_report_sent: string): Promise<void> => {
  const queryText = `
    UPDATE markets
    SET lastSlackTime = NOW(), lastSlackHourWindow = $1, last_report_sent = $3
    WHERE url = $2
  `;
  try {
    await client.query(queryText, [timeWindow, url, last_report_sent]);
    console.log('Updated lastSlackTime and lastSlackHourWindow in the database.');
  } catch (error) {
    console.error('Error updating lastSlackTime and lastSlackHourWindow in the database:', error);
  }
};

export const updateLocalMarket = async (id: string, lastslacktime: Date, lastslackhourwindow: number, last_report_sent: string): Promise<void> => {
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

export const keepAwakeHack = async (): Promise<void> => {
  const queryText = 'SELECT _id FROM markets WHERE tracked = true'
  try {
    await client.query(queryText);
    console.log('Pinged db to stay awake.');
  } catch (error) {
    console.error('Error pinging db to stay awake:', error);
  }
}
