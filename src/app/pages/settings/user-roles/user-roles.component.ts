import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { finalize } from 'rxjs/operators';
import { ConfirmationDialogComponent } from '../../../dialogs/confirmation-dialog.component';
import { UserRoleDialogComponent } from './user-role-dialog/user-role-dialog.component';
import { NotificationService } from '../../../services/notification.service';
import { Firestore, collection, doc, addDoc, updateDoc, deleteDoc, DocumentReference, query, getDocs, where, orderBy } from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';

interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  isSystem: boolean; // Whether this is a system-defined role
  createdAt: Date;
  updatedAt: Date;
  userCount: number;
}

@Component({
  selector: 'app-user-roles',
  templateUrl: './user-roles.component.html',
  styleUrls: ['./user-roles.component.scss'],
  standalone: false,
})
export class UserRolesComponent implements OnInit {
  displayedColumns: string[] = ['name', 'description', 'permissions', 'userCount', 'actions'];
  dataSource = new MatTableDataSource<UserRole>([]);
  isLoading = false;
  totalRoles = 0;
  systemRoles = 0;
  customRoles = 0;

  allPermissions: { key: string; name: string; description: string }[] = [
    { key: 'canAllocateJobs', name: 'Allocate Jobs', description: 'Assign jobs to drivers' },
    { key: 'canApproveExpenses', name: 'Approve Expenses', description: 'Review and approve expense claims' },
    { key: 'canCreateJobs', name: 'Create Jobs', description: 'Create new jobs in the system' },
    { key: 'canEditJobs', name: 'Edit Jobs', description: 'Modify existing job details' },
    { key: 'canManageUsers', name: 'Manage Users', description: 'Create, edit, and delete users' },
    { key: 'canViewReports', name: 'View Reports', description: 'Access system reports and analytics' },
    { key: 'canViewUnallocated', name: 'View Unallocated Jobs', description: 'See jobs not assigned to a driver' },
    { key: 'isAdmin', name: 'Administrator', description: 'Full system access' },
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private dialog: MatDialog, private notificationService: NotificationService, private firestore: Firestore) {}

  ngOnInit(): void {
    this.loadUserRoles();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadUserRoles(): void {
    this.isLoading = true;

    const rolesRef = collection(this.firestore, 'userRoles');
    const q = query(rolesRef, orderBy('name'));

    from(getDocs(q))
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (snapshot) => {
          const roles = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data['name'] || '',
              description: data['description'] || '',
              permissions: data['permissions'] || {},
              isSystem: data['isSystem'] || false,
              createdAt: this.convertTimestamp(data['createdAt']),
              updatedAt: this.convertTimestamp(data['updatedAt']),
              userCount: data['userCount'] || 0,
            } as UserRole;
          });

          this.dataSource.data = roles;
          this.calculateStats(roles);
        },
        error: (error) => {
          console.error('Error loading user roles:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to load user roles',
          });
        },
      });
  }

  calculateStats(roles: UserRole[]): void {
    this.totalRoles = roles.length;
    this.systemRoles = roles.filter((role) => role.isSystem).length;
    this.customRoles = roles.filter((role) => !role.isSystem).length;
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  addUserRole(): void {
    const dialogRef = this.dialog.open(UserRoleDialogComponent, {
      width: '700px',
      data: {
        isEdit: false,
        allPermissions: this.allPermissions,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isLoading = true;
        this.createUserRole(result)
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Success',
                message: `Role "${result.name}" created successfully`,
              });
              this.loadUserRoles();
            },
            error: (error) => {
              console.error('Error creating user role:', error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to create user role',
              });
            },
          });
      }
    });
  }

  editUserRole(role: UserRole): void {
    const dialogRef = this.dialog.open(UserRoleDialogComponent, {
      width: '700px',
      data: {
        isEdit: true,
        role: role,
        allPermissions: this.allPermissions,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.isLoading = true;
        this.updateUserRole(role.id, result)
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Success',
                message: `Role "${result.name}" updated successfully`,
              });
              this.loadUserRoles();
            },
            error: (error) => {
              console.error('Error updating user role:', error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to update user role',
              });
            },
          });
      }
    });
  }

  deleteUserRole(role: UserRole): void {
    if (role.isSystem) {
      this.notificationService.addNotification({
        type: 'warning',
        title: 'Cannot Delete',
        message: 'System-defined roles cannot be deleted',
      });
      return;
    }

    if (role.userCount > 0) {
      this.notificationService.addNotification({
        type: 'warning',
        title: 'Cannot Delete',
        message: `Role "${role.name}" has ${role.userCount} users assigned to it`,
      });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Role',
        message: `Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmColor: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.isLoading = true;
        this.deleteRole(role.id)
          .pipe(finalize(() => (this.isLoading = false)))
          .subscribe({
            next: () => {
              this.notificationService.addNotification({
                type: 'success',
                title: 'Success',
                message: `Role "${role.name}" deleted successfully`,
              });
              this.loadUserRoles();
            },
            error: (error) => {
              console.error('Error deleting role:', error);
              this.notificationService.addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to delete role',
              });
            },
          });
      }
    });
  }

  getPermissionsList(permissions: Record<string, boolean>): string {
    if (!permissions) return 'None';

    const activePermissions = Object.entries(permissions)
      .filter(([_, value]) => value)
      .map(([key, _]) => {
        const foundPermission = this.allPermissions.find((p) => p.key === key);
        return foundPermission ? foundPermission.name : key;
      });

    return activePermissions.length > 0 ? activePermissions.join(', ') : 'None';
  }

  private createUserRole(roleData: any): Observable<DocumentReference> {
    const rolesRef = collection(this.firestore, 'userRoles');
    const now = new Date();

    const newRole = {
      ...roleData,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
      userCount: 0,
    };

    return from(addDoc(rolesRef, newRole));
  }

  private updateUserRole(roleId: string, roleData: any): Observable<void> {
    const roleRef = doc(this.firestore, `userRoles/${roleId}`);

    const updateData = {
      ...roleData,
      updatedAt: new Date(),
    };

    return from(updateDoc(roleRef, updateData));
  }

  private deleteRole(roleId: string): Observable<void> {
    const roleRef = doc(this.firestore, `userRoles/${roleId}`);
    return from(deleteDoc(roleRef));
  }

  private convertTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();

    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate();
    }

    return new Date(timestamp);
  }
}
