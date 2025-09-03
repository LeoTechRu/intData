import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import Page from './page';

expect.extend(matchers);

describe('Index page', () => {
  it('renders greeting via Hello component', () => {
    render(<Page />);
    expect(screen.getByText('Привет, мир!')).toBeInTheDocument();
  });
});
