import { prune, setField, setNested, setCampaignPref } from '../formUtils';

describe('formUtils', () => {
  test('prune removes empty, null, and undefined values', () => {
    const obj = {
      name: 'John',
      age: null,
      email: '',
      active: true,
      address: undefined,
    };
    expect(prune(obj)).toEqual({
      name: 'John',
      active: true,
    });
  });

  test('prune handles null/undefined input safely', () => {
    expect(prune(null)).toEqual({});
    expect(prune(undefined)).toEqual({});
  });

  test('setField updates a single top-level field', () => {
    const state = { first_name: 'Alice', last_name: 'Smith' };
    const updater = setField('first_name', 'Bob');
    expect(updater(state)).toEqual({ first_name: 'Bob', last_name: 'Smith' });
  });

  test('setNested updates a field inside a nested object', () => {
    const state = {
      user: { id: 1, name: 'Alice' },
      settings: { theme: 'light' }
    };
    const updater = setNested('user', 'name', 'Bob');
    expect(updater(state)).toEqual({
      user: { id: 1, name: 'Bob' },
      settings: { theme: 'light' }
    });
  });

  test('setCampaignPref updates deep nested campaign prefs', () => {
    const state = {
      scheduler_settings: {
        frequency: 'everyday',
        campaign_notification_prefs: {
          new_campaigns: true,
          weekly_summary: false,
        }
      }
    };
    const updater = setCampaignPref('weekly_summary', true);
    expect(updater(state)).toEqual({
      scheduler_settings: {
        frequency: 'everyday',
        campaign_notification_prefs: {
          new_campaigns: true,
          weekly_summary: true,
        }
      }
    });
  });
});
