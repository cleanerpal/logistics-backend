import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FirebaseService } from '../../services/firebase.service';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  standalone: true,
  imports: [
    NgIf,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
})
export class ForgotPasswordComponent implements OnInit {
  forgotPasswordForm: FormGroup;
  loading = false;
  emailSent = false;

  constructor(
    private formBuilder: FormBuilder,
    private firebaseService: FirebaseService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    // Initialize the forgot password form
    this.forgotPasswordForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {}

  // Getter for easy access to email control
  get emailControl(): FormControl {
    return this.forgotPasswordForm.get('email') as FormControl;
  }

  onSubmit(): void {
    // Return if form is invalid
    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.loading = true;
    const email = this.emailControl.value;

    this.firebaseService
      .forgotPassword(email)
      .then(() => {
        this.emailSent = true;
        this.snackBar.open(
          'Password reset email sent. Check your inbox!',
          'Close',
          {
            duration: 5000,
            panelClass: ['success-snackbar'],
          }
        );
        this.loading = false;

        // Optional: redirect back to login after a delay
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      })
      .catch((error) => {
        let errorMessage =
          'Failed to send password reset email. Please try again.';

        if (error.code === 'auth/user-not-found') {
          errorMessage = 'No account found with this email address.';
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = 'The email address is not valid.';
        }

        this.snackBar.open(errorMessage, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });

        this.loading = false;
      });
  }
}
