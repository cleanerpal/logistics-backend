import { AsyncPipe, NgIf } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { FirebaseService } from './services/firebase.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    AsyncPipe,
    RouterOutlet,
    MatSidenavModule,
    HeaderComponent,
    SidebarComponent,
  ],
})
export class AppComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
  isAuthenticated$: Observable<boolean>;

  constructor(private firebaseService: FirebaseService) {
    this.isAuthenticated$ = this.firebaseService.isAuthenticated();
  }

  toggleSidenav(): void {
    this.sidenav.toggle();
  }
}
