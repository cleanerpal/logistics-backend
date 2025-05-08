import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { SelectionModel } from '@angular/cdk/collections';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { LeaveRequest, LeaveRequestStatus } from '../../../interfaces/leave-request.interface';
import { LeaveRequestService } from '../../../services/leave-request.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { LeaveRequestProcessDialogComponent } from '../leave-request-process-dialog/leave-request-process-dialog.component';

@Component({
  selector: 'app-leave-requests-list',
  templateUrl: './leave-requests-list.component.html',
  styleUrls: ['./leave-requests-list.component.scss'],
  standalone: false,
})
export class LeaveRequestsListComponent implements OnInit, AfterViewInit, OnDestroy {
  displayedColumns: string[] = ['select', 'driverName', 'type', 'startDate', 'endDate', 'submitted', 'status', 'actions'];
  dataSource = new MatTableDataSource<LeaveRequest>([]);
  selection = new SelectionModel<LeaveRequest>(true, []);
  isLoading = false;
  hasApprovePermission = false;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  statusFilter = 'All';
  typeFilter = 'All';

  statusOptions = ['All', 'Pending', 'Approved', 'Denied', 'Cancelled'];

  private subscriptions: Subscription[] = [];

  constructor(
    private leaveRequestService: LeaveRequestService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.checkPermissions();
    this.loadLeaveRequests();
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
    const permissionSub = this.authService.hasAnyPermission(['canApproveLeaveRequests', 'isAdmin']).subscribe((hasPermission) => {
      this.hasApprovePermission = hasPermission;
    });
    this.subscriptions.push(permissionSub);
  }

  private setupCustomFilter(): void {
    this.dataSource.filterPredicate = (data: LeaveRequest, filter: string) => {
      const searchText = filter.toLowerCase();
      const shouldInclude = (value: string | undefined) => value?.toLowerCase().includes(searchText) || false;

      // Apply status filter
      if (this.statusFilter !== 'All' && data.status !== this.statusFilter) {
        return false;
      }

      // Apply type filter
      if (this.typeFilter !== 'All' && data.type !== this.typeFilter) {
        return false;
      }

      // Apply text search
      return shouldInclude(data.driverName) || shouldInclude(data.type) || shouldInclude(data.notes);
    };
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onFilterChange(): void {
    // Force the filter to re-evaluate
    this.dataSource.filter = this.dataSource.filter || ' ';
  }

  loadLeaveRequests(): void {
    this.isLoading = true;

    const requestsSub = this.leaveRequestService
      .getLeaveRequests()
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (requests) => {
          this.dataSource.data = requests;
        },
        error: (error) => {
          console.error('Error loading leave requests:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to load leave requests',
          });
        },
      });

    this.subscriptions.push(requestsSub);
  }

  processLeaveRequest(request: LeaveRequest, isApproval: boolean): void {
    const dialogRef = this.dialog.open(LeaveRequestProcessDialogComponent, {
      width: '500px',
      data: {
        request,
        isApproval,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        if (isApproval) {
          this.approveRequest(request.id, result.notes);
        } else {
          this.denyRequest(request.id, result.notes);
        }
      }
    });
  }

  approveRequest(requestId: string, notes?: string): void {
    this.isLoading = true;

    const approveSub = this.leaveRequestService
      .approveLeaveRequest(requestId, notes)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Leave Request Approved',
            message: 'The leave request has been approved successfully',
          });
          this.loadLeaveRequests();
        },
        error: (error) => {
          console.error('Error approving leave request:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to approve leave request',
          });
        },
      });

    this.subscriptions.push(approveSub);
  }

  denyRequest(requestId: string, notes?: string): void {
    this.isLoading = true;

    const denySub = this.leaveRequestService
      .denyLeaveRequest(requestId, notes)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: () => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Leave Request Denied',
            message: 'The leave request has been denied',
          });
          this.loadLeaveRequests();
        },
        error: (error) => {
          console.error('Error denying leave request:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to deny leave request',
          });
        },
      });

    this.subscriptions.push(denySub);
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Approved':
        return 'status-green';
      case 'Denied':
        return 'status-red';
      case 'Pending':
        return 'status-orange';
      case 'Cancelled':
        return 'status-gray';
      default:
        return 'status-gray';
    }
  }

  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  toggleAllRows(): void {
    this.isAllSelected() ? this.selection.clear() : this.dataSource.data.forEach((row) => this.selection.select(row));
  }

  checkboxLabel(row?: LeaveRequest): string {
    if (!row) {
      return `${this.isAllSelected() ? 'deselect' : 'select'} all`;
    }
    return `${this.selection.isSelected(row) ? 'deselect' : 'select'} row ${row.id}`;
  }

  canProcessRequest(status: string): boolean {
    return status === LeaveRequestStatus.PENDING && this.hasApprovePermission;
  }
}
