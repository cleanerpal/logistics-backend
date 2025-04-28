import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';

import { FirebaseService } from '../../../services/firebase.service';
import { Subscription } from 'rxjs';
import { AuditLog } from '../audit-logs-list/audit-logs-list.component';

@Component({
  selector: 'app-audit-log-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
  ],
  templateUrl: './audit-log-details.component.html',
  styleUrls: ['./audit-log-details.component.scss'],
})
export class AuditLogDetailsComponent implements OnInit, OnDestroy {
  logId: string = '';
  auditLog: AuditLog | null = null;
  isLoading: boolean = true;
  error: string | null = null;

  private subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private firebaseService: FirebaseService
  ) {}

  ngOnInit(): void {
    this.logId = this.route.snapshot.paramMap.get('id') || '';

    if (!this.logId) {
      this.error = 'Invalid log ID';
      this.isLoading = false;
      return;
    }

    this.loadAuditLogDetails();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadAuditLogDetails(): void {
    this.isLoading = true;

    this.subscription.add(
      this.firebaseService
        .getDocumentWithSnapshot<AuditLog>('auditLogs', this.logId)
        .subscribe(
          (log) => {
            if (log) {
              this.auditLog = {
                ...log,
                timestamp:
                  log.timestamp instanceof Date
                    ? log.timestamp
                    : new Date(
                        (log.timestamp as { seconds: number }).seconds * 1000
                      ),
              };
            } else {
              this.error = 'Audit log not found';
            }
            this.isLoading = false;
          },
          (err) => {
            console.error('Error loading audit log:', err);
            this.error = 'Error loading audit log details';
            this.isLoading = false;
          }
        )
    );
  }

  getActionClass(action: string): string {
    if (/created/i.test(action)) return 'success';
    if (/updated|assigned/i.test(action)) return 'info';
    if (/deleted|failed/i.test(action)) return 'error';
    if (/completed|processed|success|handover/i.test(action)) return 'warning';
    return 'primary';
  }

  formatDetails(details: any): string {
    if (!details) return 'No details available';

    if (typeof details === 'object') {
      try {
        return JSON.stringify(details, null, 2);
      } catch (e) {
        return 'Error formatting details';
      }
    }

    return details.toString();
  }

  goBack(): void {
    this.router.navigate(['/audit-logs']);
  }
}
