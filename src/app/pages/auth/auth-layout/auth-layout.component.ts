import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  templateUrl: './auth-layout.component.html',
  styleUrls: ['./auth-layout.component.scss'],
  standalone: false,
})
export class AuthLayoutComponent implements OnInit {
  currentYear: number = new Date().getFullYear();

  constructor() {}

  ngOnInit(): void {
    // Check if dark theme is enabled
    const storedPreferences = localStorage.getItem('userPreferences');
    if (storedPreferences) {
      const { isDarkTheme } = JSON.parse(storedPreferences);
      if (isDarkTheme) {
        document.body.classList.add('dark-theme');
      }
    }
  }
}
