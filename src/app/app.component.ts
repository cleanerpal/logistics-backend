import { Component, ViewChild } from '@angular/core';
import { MatSidenav } from '@angular/material/sidenav';
import { FirebaseService } from './services/firebase.service';
import { Observable } from 'rxjs';
import { NgIf, AsyncPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';

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
