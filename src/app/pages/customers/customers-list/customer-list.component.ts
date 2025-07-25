import { Component, OnInit, ViewChild, OnDestroy, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';

import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { Subscription } from 'rxjs';
import { Customer, CustomerStatus, CustomerContact } from '../../../interfaces/customer.interface';
import { CustomerService } from '../../../services/customer.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-customer-list',
  templateUrl: './customer-list.component.html',
  styleUrls: ['./customer-list.component.scss'],
  standalone: false,
})
export class CustomerListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = ['name', 'address', 'primaryContact', 'status'];

  isLoading = false;
  dataSource = new MatTableDataSource<Customer>([]);
  hasEditPermission = false;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  statusFilter = 'All';
  statusOptions = ['All', 'Active', 'Inactive', 'Pending'];

  private subscriptions: Subscription[] = [];

  constructor(private router: Router, private customerService: CustomerService, private notificationService: NotificationService, private authService: AuthService) {}

  ngOnInit(): void {
    this.isLoading = true;
    this.loadCustomers();
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

      if (this.statusFilter !== 'All' && data.status !== this.statusFilter) {
        return false;
      }

      return shouldInclude(data.name) || shouldInclude(data.address) || this.searchInContacts(data, searchText);
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
    this.isLoading = true;

    const customersSub = this.customerService.getAllCustomers().subscribe({
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

  getPrimaryContact(customer: Customer): CustomerContact | null {
    const primaryContact = customer.contacts?.find((contact) => contact.isPrimary);
    if (primaryContact) {
      return primaryContact;
    }

    return customer.contacts?.length > 0 ? customer.contacts[0] : null;
  }

  getFormattedAddress(customer: Customer): string {
    if (!customer.address) {
      return 'No address provided';
    }

    if (typeof customer.address === 'string') {
      return customer.address;
    }

    // Handle structured address
    const structuredAddress = customer.address as any;
    const addressParts = [
      structuredAddress.street,
      structuredAddress.street2,
      structuredAddress.city,
      structuredAddress.county,
      structuredAddress.postcode,
      structuredAddress.country,
    ].filter((part) => part && part.trim() !== '');

    return addressParts.length > 0 ? addressParts.join(', ') : 'No address provided';
  }

  getStatusClass(status: CustomerStatus): string {
    const statusMap: Record<string, string> = {
      [CustomerStatus.ACTIVE]: 'status-active',
      [CustomerStatus.INACTIVE]: 'status-inactive',
      [CustomerStatus.PENDING]: 'status-pending',
    };
    return statusMap[status] || 'status-default';
  }

  toggleCustomerStatus(customer: Customer, event: MatSlideToggleChange): void {
    const newStatus = event.checked ? CustomerStatus.ACTIVE : CustomerStatus.INACTIVE;

    if (customer.status === newStatus) {
      return; // No change needed
    }

    this.isLoading = true;

    const updateSub = this.customerService.updateCustomer(customer.id, { status: newStatus }).subscribe({
      next: () => {
        customer.status = newStatus; // Update local data
        this.notificationService.addNotification({
          type: 'success',
          title: 'Status Updated',
          message: `${customer.name} is now ${newStatus.toLowerCase()}`,
        });
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error updating customer status:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: `Failed to update customer status: ${error.message}`,
        });
        // Revert the toggle
        event.source.checked = customer.status === CustomerStatus.ACTIVE;
        this.isLoading = false;
      },
    });

    this.subscriptions.push(updateSub);
  }

  createNewCustomer(): void {
    this.router.navigate(['/customers/new']);
  }

  viewCustomerDetails(customer: Customer): void {
    this.router.navigate(['/customers', customer.id]);
  }

  exportAllCustomers(): void {
    const allCustomers = this.dataSource.filteredData;
    this.downloadCustomersCsv(allCustomers);
  }

  private downloadCustomersCsv(customers: Customer[]): void {
    const headers = ['Name', 'Address', 'Status', 'Primary Contact Name', 'Primary Contact Email', 'Primary Contact Phone'];

    const rows = customers.map((customer) => {
      const primaryContact = this.getPrimaryContact(customer);

      return [customer.name, this.getFormattedAddress(customer), customer.status, primaryContact?.name || '', primaryContact?.email || '', primaryContact?.phone || ''];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => (typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(',')
      ),
    ].join('\n');

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
