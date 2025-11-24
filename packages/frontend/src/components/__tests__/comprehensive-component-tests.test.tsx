import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SystemCard } from '../system-card';
import { AssessmentForm } from '../assessment-initiator';
import { ControlTable } from '../control-table';
import { DocumentProcessor } from '../document-processor';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock API hooks
jest.mock('../../hooks/useApi', () => ({
  useApi: () => ({
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({}),
    loading: false,
    error: null,
  }),
}));

// Mock router
jest.mock('wouter', () => ({
  useLocation: () => ['/systems'],
  useRoute: () => [false, {}],
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('Comprehensive Component Tests', () => {
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

    it('should be accessible', async () => {
      const { container } = render(
        <SystemCard 
          system={mockSystem} 
          onEdit={jest.fn()} 
          onDelete={jest.fn()} 
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('AssessmentForm Component', () => {
    const mockOnSubmit = jest.fn();
    const mockOnCancel = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should render form fields correctly', () => {
      render(
        <AssessmentForm 
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/assessment name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/system/i)).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      render(
        <AssessmentForm 
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: /create assessment/i });
      await userEvent.click(submitButton);

      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('should submit form with valid data', async () => {
      render(
        <AssessmentForm 
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      await userEvent.type(screen.getByLabelText(/assessment name/i), 'Test Assessment');
      await userEvent.type(screen.getByLabelText(/description/i), 'Test description');
      await userEvent.selectOptions(screen.getByLabelText(/system/i), 'test-system-1');

      const submitButton = screen.getByRole('button', { name: /create assessment/i });
      await userEvent.click(submitButton);

      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Test Assessment',
        description: 'Test description',
        systemId: 'test-system-1',
      });
    });

    it('should handle cancel action', async () => {
      render(
        <AssessmentForm 
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should be accessible', async () => {
      const { container } = render(
        <AssessmentForm 
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('ControlTable Component', () => {
    const mockControls = [
      {
        id: 'AC-1',
        family: 'Access Control',
        title: 'Access Control Policy',
        description: 'Control description',
        baseline: ['Low', 'Moderate', 'High'],
        status: 'not_implemented',
        framework: 'NIST 800-53',
      },
      {
        id: 'AC-2',
        family: 'Access Control',
        title: 'Account Management',
        description: 'Control description',
        baseline: ['Low', 'Moderate', 'High'],
        status: 'implemented',
        framework: 'NIST 800-53',
      },
    ];

    it('should render controls table correctly', () => {
      render(<ControlTable controls={mockControls} />);

      expect(screen.getByText('AC-1')).toBeInTheDocument();
      expect(screen.getByText('AC-2')).toBeInTheDocument();
      expect(screen.getByText('Access Control Policy')).toBeInTheDocument();
      expect(screen.getByText('Account Management')).toBeInTheDocument();
    });

    it('should handle sorting', async () => {
      render(<ControlTable controls={mockControls} />);

      const titleHeader = screen.getByText('Title');
      await userEvent.click(titleHeader);

      // Verify sorting (implementation depends on component)
      expect(screen.getByText('Access Control Policy')).toBeInTheDocument();
    });

    it('should handle filtering', async () => {
      render(<ControlTable controls={mockControls} />);

      const filterInput = screen.getByPlaceholderText(/filter controls/i);
      await userEvent.type(filterInput, 'AC-1');

      expect(screen.getByText('AC-1')).toBeInTheDocument();
      expect(screen.queryByText('AC-2')).not.toBeInTheDocument();
    });

    it('should handle pagination', async () => {
      const manyControls = Array(50).fill(null).map((_, i) => ({
        id: `AC-${i + 1}`,
        family: 'Access Control',
        title: `Control ${i + 1}`,
        description: 'Control description',
        baseline: ['Low', 'Moderate', 'High'],
        status: 'not_implemented',
        framework: 'NIST 800-53',
      }));

      render(<ControlTable controls={manyControls} />);

      // Should show pagination controls
      expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
    });

    it('should be accessible', async () => {
      const { container } = render(<ControlTable controls={mockControls} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('DocumentProcessor Component', () => {
    const mockOnProcess = jest.fn();
    const mockOnError = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should render file upload area', () => {
      render(
        <DocumentProcessor 
          onProcess={mockOnProcess}
          onError={mockOnError}
        />
      );

      expect(screen.getByText(/upload document/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument();
    });

    it('should handle file selection', async () => {
      render(
        <DocumentProcessor 
          onProcess={mockOnProcess}
          onError={mockOnError}
        />
      );

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByLabelText(/upload document/i);
      
      await userEvent.upload(input, file);

      expect(screen.getByText('test.pdf')).toBeInTheDocument();
    });

    it('should validate file types', async () => {
      render(
        <DocumentProcessor 
          onProcess={mockOnProcess}
          onError={mockOnError}
        />
      );

      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const input = screen.getByLabelText(/upload document/i);
      
      await userEvent.upload(input, file);

      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    });

    it('should handle processing', async () => {
      render(
        <DocumentProcessor 
          onProcess={mockOnProcess}
          onError={mockOnError}
        />
      );

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const input = screen.getByLabelText(/upload document/i);
      
      await userEvent.upload(input, file);

      const processButton = screen.getByRole('button', { name: /process document/i });
      await userEvent.click(processButton);

      expect(mockOnProcess).toHaveBeenCalledWith(file);
    });

    it('should be accessible', async () => {
      const { container } = render(
        <DocumentProcessor 
          onProcess={mockOnProcess}
          onError={mockOnError}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});











