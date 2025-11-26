import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SystemCard } from '../system-card';

// Mock the API hooks
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

describe('SystemCard Component', () => {
  const mockSystem = {
    id: 'test-system-1',
    name: 'Test System',
    description: 'Test system description',
    category: 'General Support System',
    impactLevel: 'Moderate',
    complianceStatus: 'in-progress',
    owner: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should render system information correctly', () => {
    render(
      <SystemCard 
        system={mockSystem} 
        onEdit={jest.fn()} 
        onDelete={jest.fn()} 
      />
    );

    expect(screen.getByText('Test System')).toBeInTheDocument();
    expect(screen.getByText('Test system description')).toBeInTheDocument();
    expect(screen.getByText('General Support System')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('in-progress')).toBeInTheDocument();
  });

  it('should handle edit action', async () => {
    const mockOnEdit = jest.fn();
    render(
      <SystemCard 
        system={mockSystem} 
        onEdit={mockOnEdit} 
        onDelete={jest.fn()} 
      />
    );

    const editButton = screen.getByTestId('edit-system-button');
    await userEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(mockSystem);
  });

  it('should handle delete action with confirmation', async () => {
    const mockOnDelete = jest.fn();
    render(
      <SystemCard 
        system={mockSystem} 
        onEdit={jest.fn()} 
        onDelete={mockOnDelete} 
      />
    );

    const deleteButton = screen.getByTestId('delete-system-button');
    await userEvent.click(deleteButton);

    // Should show confirmation dialog
    expect(screen.getByText('Are you sure you want to delete this system?')).toBeInTheDocument();

    const confirmButton = screen.getByTestId('confirm-delete-button');
    await userEvent.click(confirmButton);

    expect(mockOnDelete).toHaveBeenCalledWith(mockSystem);
  });

  it('should cancel deletion when cancel button is clicked', async () => {
    const mockOnDelete = jest.fn();
    render(
      <SystemCard 
        system={mockSystem} 
        onEdit={jest.fn()} 
        onDelete={mockOnDelete} 
      />
    );

    const deleteButton = screen.getByTestId('delete-system-button');
    await userEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByTestId('delete-confirmation-dialog')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTestId('cancel-delete-button');
    await userEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId('delete-confirmation-dialog')).not.toBeInTheDocument();
    });

    expect(mockOnDelete).not.toHaveBeenCalled();
  });

  it('should display correct status badge color', () => {
    const systemWithStatus = { ...mockSystem, complianceStatus: 'compliant' };
    render(
      <SystemCard 
        system={systemWithStatus} 
        onEdit={jest.fn()} 
        onDelete={jest.fn()} 
      />
    );

    const statusBadge = screen.getByTestId('compliance-status-badge');
    expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('should display correct impact level badge', () => {
    const systemWithImpact = { ...mockSystem, impactLevel: 'High' };
    render(
      <SystemCard 
        system={systemWithImpact} 
        onEdit={jest.fn()} 
        onDelete={jest.fn()} 
      />
    );

    const impactBadge = screen.getByTestId('impact-level-badge');
    expect(impactBadge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should be accessible', () => {
    render(
      <SystemCard 
        system={mockSystem} 
        onEdit={jest.fn()} 
        onDelete={jest.fn()} 
      />
    );

    // Check for proper ARIA labels
    expect(screen.getByTestId('edit-system-button')).toHaveAttribute('aria-label', 'Edit system');
    expect(screen.getByTestId('delete-system-button')).toHaveAttribute('aria-label', 'Delete system');

    // Check for proper roles
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});











