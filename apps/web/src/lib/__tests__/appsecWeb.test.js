import React from 'react';
import { render, screen } from '@testing-library/react';
import { parseMarkdown } from '../parseMarkdown';

jest.mock(
  'react-router-dom',
  () => ({
    useSearchParams: () => [new URLSearchParams('ext_id=bookmarklet&v=1')],
    useNavigate: () => jest.fn(),
  }),
  { virtual: true }
);

jest.mock('@/lib/api', () => ({
  tokenStore: { get: () => null, set: jest.fn(), clear: jest.fn() },
  userStore: { get: () => null, set: jest.fn(), clear: jest.fn() },
  api: {},
  client: { post: jest.fn() },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'u1@dressapp.co', full_name: 'Test User' },
    loading: false,
    logout: jest.fn(),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k, opts) => opts?.defaultValue || _k }),
}));

import ExtensionConnect from '../../pages/ExtensionConnect';

describe('Wave 1 & 2 Web AppSec remediations', () => {
  test('parseMarkdown neutralizes unsafe javascript: and data: URIs', () => {
    const { container } = render(
      <div>
        {parseMarkdown(
          '[xss](javascript:alert(1)) [data](data:text/html,hi) [safe](https://dressapp.co/closet) [local](/pricing)'
        )}
      </div>
    );
    const links = Array.from(container.querySelectorAll('a'));
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['https://dressapp.co/closet', '/pricing']);
    expect(container.textContent).toContain('xss');
    expect(container.textContent).toContain('data');
  });

  test('ExtensionConnect rejects ext_id=bookmarklet', () => {
    render(<ExtensionConnect />);
    expect(screen.getByText(/pages\.extensionConnect\.untrusted_extension/i)).toBeTruthy();
    expect(screen.getByText(/not on the allow-list/i)).toBeTruthy();
  });
});
