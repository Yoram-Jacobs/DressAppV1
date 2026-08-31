import { fetchAndPrepareGoogleProfile } from '../googleSync';
import { api } from '../api';

jest.mock('../api', () => ({
  api: {
    googleSyncProfile: jest.fn(),
    patchMe: jest.fn(),
  },
}));

describe('googleSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchAndPrepareGoogleProfile maps response and calls patchMe with pruned data', async () => {
    const mockForm = {
      sex: 'unisex',
      phone: '',
      date_of_birth: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        region: '',
        postal_code: '',
        country: 'US',
      },
    };

    api.googleSyncProfile.mockResolvedValueOnce({
      success: true,
      sex: 'female',
      phone: '+12345678',
      date_of_birth: '1995-05-15',
      address: {
        line1: '123 St',
        line2: '',
        city: 'New York',
        region: 'NY',
        postal_code: '10001',
        country: 'US',
      },
    });

    api.patchMe.mockResolvedValueOnce({
      id: 'usr_1',
      google_connected: true,
    });

    const { newForm, updated } = await fetchAndPrepareGoogleProfile(mockForm);

    expect(api.googleSyncProfile).toHaveBeenCalledTimes(1);
    expect(api.patchMe).toHaveBeenCalledTimes(1);

    // Verify correct mapping
    expect(newForm.sex).toBe('female');
    expect(newForm.phone).toBe('+12345678');
    expect(newForm.date_of_birth).toBe('1995-05-15');
    expect(newForm.address.line1).toBe('123 St');
    expect(newForm.address.city).toBe('New York');

    // Verify prune call before patching (empty line2 should be pruned)
    expect(api.patchMe).toHaveBeenCalledWith({
      phone: '+12345678',
      date_of_birth: '1995-05-15',
      sex: 'female',
      address: {
        line1: '123 St',
        city: 'New York',
        region: 'NY',
        postal_code: '10001',
        country: 'US',
      },
    });

    expect(updated).toEqual({
      id: 'usr_1',
      google_connected: true,
    });
  });

  test('throws error if success is false', async () => {
    api.googleSyncProfile.mockResolvedValueOnce({ success: false });

    await expect(fetchAndPrepareGoogleProfile({})).rejects.toThrow(
      'Google sync profile failed',
    );
  });
});
