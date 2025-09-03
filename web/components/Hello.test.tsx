import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import Hello from './Hello';

expect.extend(matchers);

describe('Hello component', () => {
  it('renders greeting in Russian', () => {
    render(<Hello name="мир" />);
    expect(screen.getByText('Привет, мир!')).toBeInTheDocument();
  });
});
