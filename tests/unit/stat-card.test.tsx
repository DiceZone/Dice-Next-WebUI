import { fireEvent, render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { StatCard } from '../../src/components/dashboard/stat-card';

describe('Dashboard stat cards', () => {
  it('open their page as a real button when a destination is given', () => {
    const open = vi.fn();
    render(<StatCard icon={Users} label="Users" value={12} onOpen={open} openLabel="Open Players" />);
    const card = screen.getByRole('button', { name: /Users：12 · Open Players/ });
    fireEvent.click(card);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('stay plain, non-interactive text without a destination', () => {
    render(<StatCard icon={Users} label="Users" value={12} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
