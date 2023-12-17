import { Client } from 'pg';
import { LocalMarket } from './types';


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

export const fetchTrackedQuestions = async (): Promise<LocalMarket[]|undefined> => {
  const queryText = 'SELECT _id, url, lastslacktime, lastslackhourwindow, tracked, last_track_status_slack_time FROM markets WHERE tracked = true';
  try {
    const res = await client.query(queryText);
    const trackedMarkets: LocalMarket[] = res.rows.map(row => ({
      _id: row._id,
      url: row.url,
      lastslacktime: row.lastslacktime,
      lastslackhourwindow: row.lastslackhourwindow,
      tracked: row.tracked,
      last_track_status_slack_time: row.last_track_status_slack_time
    }));
    return trackedMarkets;
  } catch (error) {
    console.error('Error fetching tracked questions', error);
  }
};

export const updateLastSlackInfo = async (url: string, timeWindow: number, last_report_sent: string): Promise<void> => {
  const queryText = `
    UPDATE markets
    SET lastslacktime = NOW(), lastslackhourwindow = $1, last_report_sent = $3
    WHERE url = $2
  `;
  try {
    const result = await client.query(queryText, [timeWindow, url, last_report_sent]);
    console.log('Updated lastslacktime and lastslackhourwindow in the database.', result);
  } catch (error) {
    console.error('Error updating lastslacktime and lastslackhourwindow in the database:', error);
  }
};


export const updateNewTrackedSlackInfo = async (url: string): Promise<void> => {
  const queryText = `
    UPDATE markets
    SET last_track_status_slack_time = NOW()
    WHERE url = $1
  `;
  try {
    await client.query(queryText, [url]);
    console.log('Updated last_track_status_slack_time in the database.');
  } catch (error) {
    console.error('Error updating last_track_status_slack_time in the database:', error);
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
