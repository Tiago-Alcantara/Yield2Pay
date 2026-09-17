import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../_components/VenueMoveForm', () => ({
  VenueMoveForm: ({ mode }: { mode: string }) => <div data-testid="venue-move-form">{mode}</div>,
}));

import FamilyInvestPage from './page';

describe('/family/investir', () => {
  it('renderiza VenueMoveForm em modo deposit', () => {
    render(<FamilyInvestPage />);
    expect(screen.getByTestId('venue-move-form')).toHaveTextContent('deposit');
  });
});
