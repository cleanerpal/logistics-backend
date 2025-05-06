import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { Subscription } from 'rxjs';
import { Customer, CustomerStatus, CustomerSize } from '../../../interfaces/customer.interface';
import { CustomerService } from '../../../services/customer.service';
import { NotificationService } from '../../../services/notification.service';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { AuthService } from '../../../services/auth.service';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-customer-list',
  templateUrl: './customer-list.component.html',
  styleUrls: ['./customer-list.component.scss'],
  standalone: false,
})
export class CustomerListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = ['select', 'id', 'name', 'category', 'size', 'location', 'primaryContact', 'status', 'lastContact', 'actions'];

  isLoading = false;
  dataSource = new MatTableDataSource<Customer>([]);
  selection = new SelectionModel<Customer>(true, []);
  hasEditPermission = false;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  categoryFilter = 'All';
  sizeFilter = 'All';
  statusFilter = 'All';

  categories: string[] = [];
  sizeOptions = ['All', 'Small (1-50)', 'Medium (51-250)', 'Large (251-1000)', 'Enterprise (1000+)'];
  statusOptions = ['All', 'Active', 'Inactive', 'Pending'];

  private subscriptions: Subscription[] = [];

  constructor(
    private router: Router,
    private customerService: CustomerService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.loadCustomers();
    this.loadCategories();
    this.checkPermissions();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private checkPermissions(): void {
    const permissionSub = this.authService.hasPermission('canManageUsers').subscribe((hasPermission) => {
      this.hasEditPermission = hasPermission;
    });
    this.subscriptions.push(permissionSub);
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Customer, filter: string) => {
      const searchText = filter.toLowerCase();
      const shouldInclude = (value: string | undefined) => (value ? value.toLowerCase().includes(searchText) : false);

      // Apply category filter
      if (this.categoryFilter !== 'All' && data.category !== this.categoryFilter) {
        return false;
      }

      // Apply size filter
      if (this.sizeFilter !== 'All' && data.size !== this.sizeFilter) {
        return false;
      }

      // Apply status filter
      if (this.statusFilter !== 'All' && data.status !== this.statusFilter) {
        return false;
      }

      // Apply text search
      return shouldInclude(data.name) || shouldInclude(data.category) || shouldInclude(data.city) || this.searchInContacts(data, searchText);
    };
  }

  private searchInContacts(customer: Customer, searchText: string): boolean {
    if (!customer.contacts || customer.contacts.length === 0) return false;

    return customer.contacts.some(
      (contact) =>
        (contact.name && contact.name.toLowerCase().includes(searchText)) ||
        (contact.email && contact.email.toLowerCase().includes(searchText)) ||
        (contact.phone && contact.phone.toLowerCase().includes(searchText))
    );
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onFilterChange(): void {
    this.dataSource.filter = this.dataSource.filter || ' ';
  }

  loadCustomers(): void {
    // Reset loading state
    this.isLoading = true;

    const customersSub = this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.dataSource.data = customers;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading customers:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to load customers',
        });
        this.isLoading = false;
      },
    });

    this.subscriptions.push(customersSub);
  }

  loadCategories(): void {
    const categoriesSub = this.customerService.getCategories().subscribe({
      next: (categories) => {
        this.categories = ['All', ...categories];
      },
      error: (error) => {
        console.error('Error loading categories:', error);
      },
    });

    this.subscriptions.push(categoriesSub);
  }

  getPrimaryContact(customer: Customer): string {
    const primaryContact = customer.contacts?.find((contact) => contact.isPrimary);
    if (primaryContact) {
      return primaryContact.email;
    }

    // Return first contact email if no primary
    return customer.contacts?.length > 0 ? customer.contacts[0].email : 'N/A';
  }

  getContactsCount(customer: Customer): number {
    return customer.contacts?.length || 0;
  }

  getSizeClass(size: CustomerSize | undefined): string {
    if (!size) return 'size-default';

    const sizeMap: Record<string, string> = {
      [CustomerSize.SMALL]: 'size-small',
      [CustomerSize.MEDIUM]: 'size-medium',
      [CustomerSize.LARGE]: 'size-large',
      [CustomerSize.ENTERPRISE]: 'size-enterprise',
    };
    return sizeMap[size] || 'size-default';
  }

  getStatusClass(status: CustomerStatus): string {
    const statusMap: Record<string, string> = {
      [CustomerStatus.ACTIVE]: 'status-active',
      [CustomerStatus.INACTIVE]: 'status-inactive',
      [CustomerStatus.PENDING]: 'status-pending',
    };
    return statusMap[status] || 'status-default';
  }

  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.dataSource.data);
  }

  checkboxLabel(row?: Customer): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id}`;
  }

  createNewCustomer(): void {
    this.router.navigate(['/customers/new']);
  }

  editCustomer(customer: Customer, event?: Event): void {
    if (event) {
      event.stopPropagation(); // Prevent row click event
    }
    this.router.navigate(['/customers', customer.id, 'edit']);
  }

  viewCustomerDetails(customer: Customer): void {
    this.router.navigate(['/customers', customer.id]);
  }

  deleteCustomer(customer: Customer, event?: Event): void {
    if (event) {
      event.stopPropagation(); // Prevent row click event
    }

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Customer',
        message: `Are you sure you want to delete ${customer.name}? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isLoading = true;

        const deleteSub = this.customerService.deleteCustomer(customer.id).subscribe({
          next: () => {
            this.notificationService.addNotification({
              type: 'success',
              title: 'Customer Deleted',
              message: `${customer.name} has been deleted successfully`,
            });
            this.selection.deselect(customer);
            this.loadCustomers();
          },
          error: (error) => {
            console.error('Error deleting customer:', error);
            this.notificationService.addNotification({
              type: 'error',
              title: 'Error',
              message: `Failed to delete customer: ${error.message}`,
            });
            this.isLoading = false;
          },
        });

        this.subscriptions.push(deleteSub);
      }
    });
  }

  exportAllCustomers(): void {
    const allCustomers = this.dataSource.filteredData;
    this.downloadCustomersCsv(allCustomers);
  }

  exportSelectedCustomers(): void {
    const selectedCustomers = this.selection.selected;
    if (selectedCustomers.length === 0) {
      this.notificationService.addNotification({
        type: 'warning',
        title: 'No Customers Selected',
        message: 'Please select at least one customer to export',
      });
      return;
    }
    this.downloadCustomersCsv(selectedCustomers);
  }

  private downloadCustomersCsv(customers: Customer[]): void {
    // Define headers
    const headers = [
      'ID',
      'Name',
      'Category',
      'Size',
      'Status',
      'Address',
      'City',
      'Postcode',
      'Country',
      'Primary Contact Name',
      'Primary Contact Email',
      'Primary Contact Phone',
      'Website',
      'Created Date',
      'Last Contact',
    ];

    // Create rows
    const rows = customers.map((customer) => {
      const primaryContact = customer.contacts?.find((contact) => contact.isPrimary) || customer.contacts?.[0] || {};

      return [
        customer.id,
        customer.name,
        customer.category || '',
        customer.size || '',
        customer.status,
        customer.address || '',
        customer.city || '',
        customer.postcode || '',
        customer.country || '',
        primaryContact.name || '',
        primaryContact.email || '',
        primaryContact.phone || '',
        customer.website || '',
        customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '',
        customer.lastContact ? new Date(customer.lastContact).toLocaleDateString() : '',
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) =>
            // Handle cells that might contain commas by wrapping in quotes
            typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) ? `"${cell.replace(/"/g, '""')}"` : cell
          )
          .join(',')
      ),
    ].join('\n');

    // Create and download blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `customers_export_${new Date().toISOString().slice(0, 10)}.csv`;
    saveAs(blob, filename);

    this.notificationService.addNotification({
      type: 'success',
      title: 'Export Complete',
      message: `${customers.length} customers exported to CSV`,
    });
  }

  refreshData(): void {
    this.loadCustomers();
  }
}
