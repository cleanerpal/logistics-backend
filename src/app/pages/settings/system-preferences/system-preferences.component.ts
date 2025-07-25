import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationService } from '../../../services/notification.service';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { finalize } from 'rxjs/operators';
import { from } from 'rxjs';

interface SystemPreference {
  id: string;
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'select' | 'email' | 'date';
  description: string;
  group: string;
  options?: string[];
  placeholder?: string;
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  updatedAt?: Date;
}

interface PreferenceGroup {
  name: string;
  icon: string;
  description: string;
  preferences: SystemPreference[];
}

@Component({
  selector: 'app-system-preferences',
  templateUrl: './system-preferences.component.html',
  styleUrls: ['./system-preferences.component.scss'],
  standalone: false,
})
export class SystemPreferencesComponent implements OnInit {
  preferenceForms: { [key: string]: FormGroup } = {};
  preferenceGroups: PreferenceGroup[] = [];
  isLoading = false;
  isSaving = false;
  expandedPanels: { [key: string]: boolean } = {};

  constructor(private fb: FormBuilder, private firestore: Firestore, private snackBar: MatSnackBar, private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.loadPreferences();
  }

  loadPreferences(): void {
    this.isLoading = true;

    const preferencesRef = doc(this.firestore, 'systemConfig/preferences');

    from(getDoc(preferencesRef))
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (docSnap) => {
          if (docSnap.exists()) {
            const preferences = this.mapPreferencesFromFirestore(docSnap.data());
            this.organizePreferencesByGroup(preferences);
            this.createPreferenceForms();

            this.preferenceGroups.forEach((group) => {
              this.expandedPanels[group.name] = true;
            });
          } else {
            this.createDefaultPreferences();
          }
        },
        error: (error) => {
          console.error('Error loading system preferences:', error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to load system preferences',
          });
        },
      });
  }

  private mapPreferencesFromFirestore(data: any): SystemPreference[] {
    const preferences: SystemPreference[] = [];

    Object.entries(data).forEach(([id, preferenceData]: [string, any]) => {
      preferences.push({
        id,
        name: preferenceData.name || id,
        value: preferenceData.value,
        type: preferenceData.type || 'string',
        description: preferenceData.description || '',
        group: preferenceData.group || 'General',
        options: preferenceData.options || [],
        placeholder: preferenceData.placeholder,
        required: preferenceData.required !== undefined ? preferenceData.required : true,
        validation: preferenceData.validation || {},
        updatedAt: this.convertTimestamp(preferenceData.updatedAt),
      });
    });

    return preferences;
  }

  private organizePreferencesByGroup(preferences: SystemPreference[]): void {
    const groupMap: { [key: string]: SystemPreference[] } = {};

    preferences.forEach((pref) => {
      if (!groupMap[pref.group]) {
        groupMap[pref.group] = [];
      }
      groupMap[pref.group].push(pref);
    });

    this.preferenceGroups = Object.entries(groupMap).map(([groupName, prefs]) => {
      return {
        name: groupName,
        icon: this.getGroupIcon(groupName),
        description: this.getGroupDescription(groupName),
        preferences: prefs,
      };
    });

    this.preferenceGroups.sort((a, b) => {
      if (a.name === 'General') return -1;
      if (b.name === 'General') return 1;
      return a.name.localeCompare(b.name);
    });
  }

  private createPreferenceForms(): void {
    this.preferenceGroups.forEach((group) => {
      const groupForm = this.fb.group({});

      group.preferences.forEach((pref) => {
        const validators = [];

        if (pref.required) {
          validators.push(Validators.required);
        }

        if (pref.type === 'email') {
          validators.push(Validators.email);
        }

        if (pref.validation) {
          if (pref.validation.min !== undefined) {
            validators.push(Validators.min(pref.validation.min));
          }

          if (pref.validation.max !== undefined) {
            validators.push(Validators.max(pref.validation.max));
          }

          if (pref.validation.pattern) {
            validators.push(Validators.pattern(pref.validation.pattern));
          }
        }

        groupForm.addControl(pref.id, this.fb.control(pref.value, validators));
      });

      this.preferenceForms[group.name] = groupForm;
    });
  }

  savePreferenceGroup(groupName: string): void {
    const form = this.preferenceForms[groupName];

    if (form.invalid) {
      this.snackBar.open('Please fix the validation errors before saving', 'OK', {
        duration: 5000,
      });
      return;
    }

    this.isSaving = true;

    const group = this.preferenceGroups.find((g) => g.name === groupName);
    if (!group) return;

    const preferencesRef = doc(this.firestore, 'systemConfig/preferences');
    const updateData: { [key: string]: any } = {};

    group.preferences.forEach((pref) => {
      const newValue = form.get(pref.id)?.value;

      updateData[pref.id] = {
        name: pref.name,
        value: newValue,
        type: pref.type,
        description: pref.description,
        group: pref.group,
        options: pref.options || [],
        placeholder: pref.placeholder,
        required: pref.required !== undefined ? pref.required : true,
        validation: pref.validation || {},
        updatedAt: new Date(),
      };
    });

    from(setDoc(preferencesRef, updateData, { merge: true }))
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: () => {
          this.notificationService.addNotification({
            type: 'success',
            title: 'Success',
            message: `${groupName} preferences saved successfully`,
          });

          group.preferences.forEach((pref) => {
            pref.value = form.get(pref.id)?.value;
            pref.updatedAt = new Date();
          });
        },
        error: (error) => {
          console.error(`Error saving ${groupName} preferences:`, error);
          this.notificationService.addNotification({
            type: 'error',
            title: 'Error',
            message: `Failed to save ${groupName} preferences`,
          });
        },
      });
  }

  createDefaultPreferences(): void {
    const defaultPreferences: { [key: string]: any } = {
      company_name: {
        name: 'Company Name',
        value: 'My Logistics Company',
        type: 'string',
        description: 'Name of the company',
        group: 'General',
        required: true,
      },
      company_email: {
        name: 'Company Email',
        value: 'info@example.com',
        type: 'email',
        description: 'Primary contact email',
        group: 'General',
        required: true,
      },
      company_phone: {
        name: 'Company Phone',
        value: '+44 20 7123 4567',
        type: 'string',
        description: 'Primary contact phone number',
        group: 'General',
        required: true,
      },
      currency: {
        name: 'Currency',
        value: 'GBP',
        type: 'select',
        options: ['GBP', 'USD', 'EUR', 'CAD', 'AUD'],
        description: 'Default currency for the system',
        group: 'General',
        required: true,
      },
      date_format: {
        name: 'Date Format',
        value: 'DD/MM/YYYY',
        type: 'select',
        options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
        description: 'Format for displaying dates',
        group: 'Display',
        required: true,
      },
      time_format: {
        name: 'Time Format',
        value: '12h',
        type: 'select',
        options: ['12h', '24h'],
        description: 'Format for displaying times',
        group: 'Display',
        required: true,
      },
      default_language: {
        name: 'Default Language',
        value: 'English',
        type: 'select',
        options: ['English', 'Spanish', 'French', 'German'],
        description: 'Default language for the application',
        group: 'Display',
        required: true,
      },
      enable_notifications: {
        name: 'Enable Notifications',
        value: true,
        type: 'boolean',
        description: 'Enable system-wide notifications',
        group: 'Notifications',
        required: true,
      },
      email_notifications: {
        name: 'Email Notifications',
        value: true,
        type: 'boolean',
        description: 'Send notifications via email',
        group: 'Notifications',
        required: true,
      },
      expense_approval_required: {
        name: 'Expense Approval Required',
        value: true,
        type: 'boolean',
        description: 'Require approval for expenses',
        group: 'Finance',
        required: true,
      },
      expense_limit: {
        name: 'Expense Limit',
        value: 500,
        type: 'number',
        description: 'Maximum amount for expenses without additional approval',
        group: 'Finance',
        required: true,
        validation: {
          min: 0,
        },
      },
      default_tax_rate: {
        name: 'Default Tax Rate (%)',
        value: 20,
        type: 'number',
        description: 'Default tax rate percentage',
        group: 'Finance',
        required: true,
        validation: {
          min: 0,
          max: 100,
        },
      },
    };

    const preferencesRef = doc(this.firestore, 'systemConfig/preferences');

    from(setDoc(preferencesRef, defaultPreferences)).subscribe({
      next: () => {
        this.loadPreferences(); // Reload the preferences
      },
      error: (error) => {
        console.error('Error creating default preferences:', error);
        this.notificationService.addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to create default system preferences',
        });
      },
    });
  }

  resetToDefaults(): void {
    const confirmReset = window.confirm('Are you sure you want to reset all preferences to defaults? This action cannot be undone.');

    if (confirmReset) {
      this.isLoading = true;
      this.createDefaultPreferences();
    }
  }

  private getGroupIcon(groupName: string): string {
    const iconMap: { [key: string]: string } = {
      General: 'settings',
      Display: 'desktop_windows',
      Notifications: 'notifications',
      Finance: 'attach_money',
      Jobs: 'work',
      Users: 'people',
      Security: 'security',
    };

    return iconMap[groupName] || 'settings';
  }

  private getGroupDescription(groupName: string): string {
    const descriptionMap: { [key: string]: string } = {
      General: 'Basic company and system settings',
      Display: 'Appearance and formatting preferences',
      Notifications: 'System and user notification settings',
      Finance: 'Financial and expense settings',
      Jobs: 'Default job configuration',
      Users: 'User account settings',
      Security: 'Security and access control settings',
    };

    return descriptionMap[groupName] || '';
  }

  private convertTimestamp(timestamp: any): Date | undefined {
    if (!timestamp) return undefined;

    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
      return timestamp.toDate();
    }

    return new Date(timestamp);
  }
}
