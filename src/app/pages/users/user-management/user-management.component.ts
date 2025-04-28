import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatTableModule,
  MatTable,
  MatTableDataSource,
} from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  Subject,
  Subscription,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs';
import { where } from '@angular/fire/firestore';
import { FirebaseService } from '../../../services/firebase.service';
import { AuditLogsService } from '../../../services/audit-logs.service';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

interface User {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  role?: 'SuperAdmin' | 'Admin' | 'Driver';
  team?: string;
  driverId?: string;
  lastActive?: Date;
  photoURL?: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinner,
  ],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss'],
})
export class UserManagementComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTable) table!: MatTable<User>;

  dataSource = new MatTableDataSource<User>([]);
  displayedColumns: string[] = [
    'displayName',
    'email',
    'role',
    'team',
    'lastActive',
    'actions',
  ];

  searchControl = new FormControl('');
  roleFilterControl = new FormControl('All');

  roles: { value: string; label: string }[] = [
    { value: 'All', label: 'All Roles' },
    { value: 'SuperAdmin', label: 'Super Admin' },
    { value: 'Admin', label: 'Admin' },
    { value: 'Driver', label: 'Driver' },
  ];

  isLoading = true;
  private usersSubscription?: Subscription;
  private destroy$ = new Subject<void>();

  constructor(
    private firebaseService: FirebaseService,
    private auditLogsService: AuditLogsService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.setupSearchListener();
    this.setupRoleFilterListener();
    this.loadUsers();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'lastActive':
          return item.lastActive ? item.lastActive.getTime() : 0;
        default:
          return (item[property as keyof User] as string) || '';
      }
    };
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }
  }

  private setupSearchListener(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((searchTerm) => {
        this.applyFilter(searchTerm || '');
      });
  }

  private setupRoleFilterListener(): void {
    this.roleFilterControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadUsers();
      });
  }

  private loadUsers(): void {
    this.isLoading = true;
    const roleFilter = this.roleFilterControl.value;

    // Unsubscribe from previous subscription if it exists
    if (this.usersSubscription) {
      this.usersSubscription.unsubscribe();
    }

    // Build query constraints based on role filter
    const queryConstraints = [];
    if (roleFilter !== 'All' && roleFilter) {
      queryConstraints.push(where('role', '==', roleFilter));
    }

    // Get users with real-time updates
    this.usersSubscription = this.firebaseService
      .getCollectionWithSnapshot<User>(
        'users',
        queryConstraints.length > 0 ? queryConstraints : undefined
      )
      .subscribe({
        next: (users) => {
          this.dataSource.data = users.map((user) => ({
            ...user,
            lastActive: user.lastActive ? new Date(user.lastActive) : undefined,
          }));
          this.isLoading = false;

          // If there's a search term, apply it
          const searchTerm = this.searchControl.value;
          if (searchTerm) {
            this.applyFilter(searchTerm);
          }
        },
        error: (error) => {
          console.error('Error loading users:', error);
          this.snackBar.open(
            'Error loading users. Please try again.',
            'Close',
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            }
          );
          this.isLoading = false;
        },
      });
  }

  applyFilter(filterValue: string): void {
    const normalizedFilter = filterValue.toLowerCase().trim();
    this.dataSource.filterPredicate = (data: User, filter: string) => {
      return (
        data.displayName?.toLowerCase().includes(filter) ||
        false ||
        data.email.toLowerCase().includes(filter) ||
        false
      );
    };
    this.dataSource.filter = normalizedFilter;

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  navigateToUserForm(userId?: string): void {
    if (userId) {
      this.router.navigate(['/users/edit', userId]);
    } else {
      this.router.navigate(['/users/create']);
    }
  }

  formatDate(date?: Date): string {
    if (!date) return 'Never';

    // Check if date is more than 1 day old
    const now = new Date();
    const oneDayMs = 86400000; // 24 hours in milliseconds

    if (now.getTime() - date.getTime() > oneDayMs) {
      return date.toLocaleDateString();
    } else {
      return date.toLocaleTimeString();
    }
  }

  deleteUser(user: User, event: Event): void {
    // Stop event propagation to prevent row click event
    event.stopPropagation();

    if (
      confirm(
        `Are you sure you want to delete user ${
          user.displayName || user.email
        }?`
      )
    ) {
      this.firebaseService
        .deleteDocument('users', user.id)
        .then(() => {
          // Log action to audit logs
          this.auditLogsService.createAuditLog({
            action: 'DELETE',
            resource: 'users',
            resourceId: user.id,
            details: `Deleted user: ${user.displayName || user.email}`,
            userId: user.id,
            userName: user.displayName || user.email,
          });

          this.snackBar.open('User deleted successfully', 'Close', {
            duration: 3000,
          });
        })
        .catch((error) => {
          console.error('Error deleting user:', error);
          this.snackBar.open(
            'Error deleting user. Please try again.',
            'Close',
            {
              duration: 5000,
              panelClass: ['error-snackbar'],
            }
          );
        });
    }
  }
}
