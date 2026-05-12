import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn().mockImplementation((url) => {
    if (typeof url === 'string' && url.includes('/events/can')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          events: [
            {
              timestamp: '2026-05-11T10:01:00.000Z',
              image_url: 'http://edge.local/captures/can_1.jpg',
              detections: [
                { label: 'Coke', confidence: 93.2 },
              ],
            },
          ],
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({
        events: [
          {
            timestamp: '2026-05-11T10:00:00.000Z',
            image_url: 'http://edge.local/captures/demo_1.jpg',
            detections: [
              {
                gender: 'Male',
                gender_confidence: 96,
                age_group: '25-32',
                age_confidence: 91,
              },
            ],
          },
        ],
      }),
    });
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

test('renders smart cooler dashboard shell', async () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /retail restock command/i });
  expect(heading).toBeInTheDocument();
  expect(screen.getByText(/smart cooler intelligence/i)).toBeInTheDocument();
  expect(await screen.findByText(/demographics: live/i)).toBeInTheDocument();
  expect(await screen.findByText(/can model: live/i)).toBeInTheDocument();
});
