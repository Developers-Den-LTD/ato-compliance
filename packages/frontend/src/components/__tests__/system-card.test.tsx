// Unit tests for SystemCard component
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SystemCard } from '../system-card';
import { testUtils } from '../../test/setup';

// Mock the API calls
jest.mock('../../hooks/useApi', () => ({
  useApi: () => ({
    delete: jest.fn().mockResolvedValue({}),
    loading: false,
    error: null,
  }),
}));

// Mock the router
jest.mock('wouter', () => ({
  useLocation: () => ['/systems'],
  useRoute: () => [false, {}],
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('SystemCard', () => {
  const mockSystem = testUtils.createMockSystem();

  it('should render system information correctly', () => {
    render(<SystemCard system={mockSystem} onEdit={jest.fn()} onDelete={jest.fn()} />);

    expect(screen.getByText(mockSystem.name)).toBeInTheDocument();
    expect(screen.getByText(mockSystem.description)).toBeInTheDocument();
    expect(screen.getByText(mockSystem.category)).toBeInTheDocument();
    expect(screen.getByText(mockSystem.impactLevel)).toBeInTheDocument();
    expect(screen.getByText(mockSystem.complianceStatus)).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    const mockOnEdit = jest.fn();
    render(<SystemCard system={mockSystem} onEdit={mockOnEdit} onDelete={jest.fn()} />);

    const editButton = screen.getByTestId('edit-system-button');
    fireEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(mockSystem);
  });

  it('should call onDelete when delete button is clicked', () => {
    const mockOnDelete = jest.fn();
    render(<SystemCard system={mockSystem} onEdit={jest.fn()} onDelete={mockOnDelete} />);

    const deleteButton = screen.getByTestId('delete-system-button');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockSystem);
  });

  it('should show confirmation dialog when delete is clicked', async () => {
    const mockOnDelete = jest.fn();
    render(<SystemCard system={mockSystem} onEdit={jest.fn()} onDelete={mockOnDelete} />);

    const deleteButton = screen.getByTestId('delete-system-button');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByTestId('delete-confirmation-dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Are you sure you want to delete this system?')).toBeInTheDocument();
  });

  it('should confirm deletion when confirm button is clicked', async () => {
    const mockOnDelete = jest.fn();
    render(<SystemCard system={mockSystem} onEdit={jest.fn()} onDelete={mockOnDelete} />);

    const deleteButton = screen.getByTestId('delete-system-button');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByTestId('delete-confirmation-dialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByTestId('confirm-delete-button');
    fireEvent.click(confirmButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockSystem);
  });

  it('should cancel deletion when cancel button is clicked', async () => {
    const mockOnDelete = jest.fn();
    render(<SystemCard system={mockSystem} onEdit={jest.fn()} onDelete={mockOnDelete} />);

    const deleteButton = screen.getByTestId('delete-system-button');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByTestId('delete-confirmation-dialog')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTestId('cancel-delete-button');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId('delete-confirmation-dialog')).not.toBeInTheDocument();
    });

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should display correct status badge color', () => {
    const systemWithStatus = { ...mockSystem, complianceStatus: 'compliant' };
    render(<SystemCard system={systemWithStatus} onEdit={jest.fn()} onDelete={jest.fn()} />);

    const statusBadge = screen.getByTestId('compliance-status-badge');
    expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should display correct impact level badge', () => {
    const systemWithImpact = { ...mockSystem, impactLevel: 'High' };
    render(<SystemCard system={systemWithImpact} onEdit={jest.fn()} onDelete={jest.fn()} />);

    const impactBadge = screen.getByTestId('impact-level-badge');
    expect(impactBadge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should be accessible', () => {
    render(<SystemCard system={mockSystem} onEdit={jest.fn()} onDelete={jest.fn()} />);

    // Check for proper ARIA labels
    expect(screen.getByTestId('edit-system-button')).toHaveAttribute('aria-label', 'Edit system');
    expect(screen.getByTestId('delete-system-button')).toHaveAttribute('aria-label', 'Delete system');

    // Check for proper roles
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});
