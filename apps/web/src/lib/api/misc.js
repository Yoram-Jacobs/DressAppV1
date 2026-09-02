import { client } from './client.js';

export const calendar = {
  calendarStatus: () => client.get('/calendar/status').then((r) => r.data),
  calendarUpcoming: (hours = 48) =>
    client.get('/calendar/upcoming', { params: { hours_ahead: hours } }).then((r) => r.data),
};

export const misc = {
  predictMeasurements: (body) => client.post('/sizes/predict-measurements', body).then((r) => r.data),
};
