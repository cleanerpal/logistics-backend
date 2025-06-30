import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, combineLatest } from 'rxjs';
import { AuthService } from './services/auth.service';
import { AppStateService } from './services/app-state.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'logistics-backend';
  isAuthenticated = false;
  isAuthPage = false;
  hasSidebar = false;
  private stateSubscription: Subscription | null = null;

  constructor(private authService: AuthService, private appStateService: AppStateService) {}

  ngOnInit(): void {
    this.stateSubscription = combineLatest([this.authService.isAuthenticated(), this.appStateService.isAuthPage()]).subscribe(([isAuthenticated, isAuthPage]) => {
      this.isAuthenticated = isAuthenticated;
      this.isAuthPage = isAuthPage;
      this.hasSidebar = isAuthenticated && !isAuthPage;
    });
  }

  ngOnDestroy(): void {
    if (this.stateSubscription) {
      this.stateSubscription.unsubscribe();
    }
  }
}
