import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

interface PermissionInfo {
  key: string;
  name: string;
  description: string;
}

interface UserRole {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  userCount: number;
}

interface DialogData {
  isEdit: boolean;
  role?: UserRole;
  allPermissions: PermissionInfo[];
}

@Component({
  selector: 'app-user-role-dialog',
  templateUrl: './user-role-dialog.component.html',
  styleUrls: ['./user-role-dialog.component.scss'],
  standalone: false,
})
export class UserRoleDialogComponent implements OnInit {
  roleForm!: FormGroup;
  isEdit: boolean;
  allPermissions: PermissionInfo[] = [];

  specialPermissions = ['isAdmin'];

  permissionGroups = [
    {
      title: 'General Permissions',
      permissions: ['isAdmin'],
    },
    {
      title: 'Job Management',
      permissions: ['canCreateJobs', 'canEditJobs', 'canAllocateJobs', 'canViewUnallocated'],
    },
    {
      title: 'Administrative',
      permissions: ['canManageUsers', 'canViewReports', 'canApproveExpenses'],
    },
  ];

  constructor(private fb: FormBuilder, public dialogRef: MatDialogRef<UserRoleDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: DialogData) {
    this.isEdit = data.isEdit;
    this.allPermissions = data.allPermissions;
  }

  ngOnInit(): void {
    this.createForm();
  }

  createForm(): void {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      description: ['', [Validators.required, Validators.maxLength(200)]],
    });

    const permissionsGroup = this.fb.group({});

    this.allPermissions.forEach((permission) => {
      permissionsGroup.addControl(permission.key, this.fb.control(false));
    });

    this.roleForm.addControl('permissions', permissionsGroup);

    if (this.isEdit && this.data.role) {
      this.roleForm.patchValue({
        name: this.data.role.name,
        description: this.data.role.description,
      });

      const permissionsValue: Record<string, boolean> = {};
      this.allPermissions.forEach((permission) => {
        permissionsValue[permission.key] = this.data.role?.permissions?.[permission.key] || false;
      });

      this.roleForm.get('permissions')?.patchValue(permissionsValue);
    }
  }

  onSubmit(): void {
    if (this.roleForm.invalid) {
      return;
    }

    const formValue = this.roleForm.value;

    const roleData = {
      name: formValue.name,
      description: formValue.description,
      permissions: formValue.permissions,
    };

    this.dialogRef.close(roleData);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onAdminChange(event: any): void {
    const isAdmin = event.checked;
    const permissionsGroup = this.roleForm.get('permissions') as FormGroup;

    if (isAdmin) {
      this.allPermissions.forEach((permission) => {
        if (permission.key !== 'isAdmin') {
          permissionsGroup.get(permission.key)?.setValue(true);
          permissionsGroup.get(permission.key)?.disable();
        }
      });
    } else {
      this.allPermissions.forEach((permission) => {
        if (permission.key !== 'isAdmin') {
          permissionsGroup.get(permission.key)?.enable();
        }
      });
    }
  }

  getGroupPermissions(groupKey: string): PermissionInfo[] {
    const group = this.permissionGroups.find((g) => g.title === groupKey);
    if (!group) return [];

    return this.allPermissions.filter((p) => group.permissions.includes(p.key));
  }

  isSpecialPermission(key: string): boolean {
    return this.specialPermissions.includes(key);
  }
}
