import { render, screen } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      timestamp: '2026-05-11T10:00:00.000Z',
      detections: [
        {
          gender: 'Male',
          gender_confidence: 96,
          age_group: '25-32',
          age_confidence: 91,
        },
      ],
    }),
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
  expect(screen.getByRole('button', { name: /start simulator/i })).toBeInTheDocument();
  expect(await screen.findByText(/live/i)).toBeInTheDocument();
});
