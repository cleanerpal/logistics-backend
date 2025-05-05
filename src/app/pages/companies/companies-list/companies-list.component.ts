import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';

interface Company {
  id: string;
  name: string;
  industry: string;
  size: CompanySize;
  location: string;
  status: CompanyStatus;
  lastContact: Date;
}

type CompanySize = 'small' | 'medium' | 'enterprise';
type CompanyStatus = 'active' | 'inactive' | 'pending';

@Component({
  selector: 'app-companies-list',
  templateUrl: './companies-list.component.html',
  styleUrls: ['./companies-list.component.scss'],
})
export class CompaniesListComponent implements OnInit, AfterViewInit {
  displayedColumns: string[] = [
    'select',
    'id',
    'name',
    'industry',
    'size',
    'location',
    'status',
    'lastContact',
    'actions',
  ];

  isLoading = false;
  dataSource = new MatTableDataSource<Company>([]);
  selection = new SelectionModel<Company>(true, []);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  industryFilter = 'All';
  sizeFilter = 'All';
  statusFilter = 'All';

  industryOptions = [
    'All',
    'Technology',
    'Manufacturing',
    'Retail',
    'Healthcare',
    'Finance',
  ];
  sizeOptions = ['All', 'Small', 'Medium', 'Enterprise'];
  statusOptions = ['All', 'Active', 'Inactive', 'Pending'];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadCompanies();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
    this.setupCustomFilter();
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: Company, filter: string) => {
      const searchText = filter.toLowerCase();
      const shouldInclude = (value: string) =>
        value.toLowerCase().includes(searchText);

      if (
        this.industryFilter !== 'All' &&
        data.industry !== this.industryFilter
      )
        return false;

      if (
        this.sizeFilter !== 'All' &&
        data.size !== this.sizeFilter.toLowerCase()
      )
        return false;

      if (
        this.statusFilter !== 'All' &&
        data.status !== this.statusFilter.toLowerCase()
      )
        return false;

      return (
        shouldInclude(data.name) ||
        shouldInclude(data.industry) ||
        shouldInclude(data.location)
      );
    };
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  onFilterChange(): void {
    this.dataSource.filter = this.dataSource.filter || ' ';
  }

  loadCompanies(): void {
    this.isLoading = true;

    // Simulate API call with mock data
    setTimeout(() => {
      const mockCompanies: Company[] = Array(25)
        .fill(null)
        .map((_, index) => ({
          id: `COM${String(index + 1).padStart(4, '0')}`,
          name: `Company ${index + 1}`,
          industry: this.getRandomIndustry(),
          size: this.getRandomSize(),
          location: `City ${index + 1}`,
          status: this.getRandomStatus(),
          lastContact: new Date(2024, 0, index + 1),
        }));

      this.dataSource.data = mockCompanies;
      this.isLoading = false;
    }, 1000);
  }

  private getRandomIndustry(): string {
    const industries = [
      'Technology',
      'Manufacturing',
      'Retail',
      'Healthcare',
      'Finance',
    ];
    return industries[Math.floor(Math.random() * industries.length)];
  }

  private getRandomSize(): CompanySize {
    const sizes: CompanySize[] = ['small', 'medium', 'enterprise'];
    return sizes[Math.floor(Math.random() * sizes.length)];
  }

  private getRandomStatus(): CompanyStatus {
    const statuses: CompanyStatus[] = ['active', 'inactive', 'pending'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  getSizeClass(size: string): string {
    return `size-${size}`;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
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

  checkboxLabel(row?: Company): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${
      row.id
    }`;
  }

  createNewCompany(): void {
    this.router.navigate(['/companies/new']);
  }

  editCompany(company: Company): void {
    this.router.navigate(['/companies', company.id, 'edit']);
  }

  viewCompanyDetails(company: Company): void {
    this.router.navigate(['/companies', company.id]);
  }

  deleteCompany(company: Company): void {
    console.log('Deleting company:', company.id);
    // Implement delete functionality
  }

  exportAllCompanies(): void {
    const allCompanies = this.dataSource.filteredData;
    this.downloadCompaniesCsv(allCompanies);
  }

  exportSelectedCompanies(): void {
    const selectedCompanies = this.selection.selected;
    if (selectedCompanies.length === 0) {
      console.log('No companies selected');
      return;
    }
    this.downloadCompaniesCsv(selectedCompanies);
  }

  private downloadCompaniesCsv(companies: Company[]): void {
    const headers = [
      'ID',
      'Name',
      'Industry',
      'Size',
      'Location',
      'Status',
      'Last Contact',
    ];
    const rows = companies.map((company) => [
      company.id,
      company.name,
      company.industry,
      company.size,
      company.location,
      company.status,
      new Date(company.lastContact).toLocaleDateString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'companies.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
