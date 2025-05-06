import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.scss'],
  standalone: false,
})
export class SignUpComponent implements OnInit {
  signUpForm: FormGroup;
  loading = false;
  hidePassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private notificationService: NotificationService
  ) {
    this.signUpForm = this.fb.group(
      {
        firstName: ['', [Validators.required]],
        lastName: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        acceptTerms: [false, [Validators.requiredTrue]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );
  }

  ngOnInit(): void {
    // Check if already logged in
    this.authService.user$.subscribe((user) => {
      if (user) {
        this.router.navigate(['/dashboard']);
      }
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    return null;
  }

  onSubmit(): void {
    if (this.signUpForm.invalid) {
      return;
    }

    this.loading = true;
    const { firstName, lastName, email, password } = this.signUpForm.value;

    // Extend the signUp method to handle user profile creation
    this.authService
      .signUp(email, password, { firstName, lastName })
      .subscribe({
        next: () => {
          this.loading = false;
          this.notificationService.addNotification({
            type: 'success',
            title: 'Account Created',
            message: 'Your account has been successfully created',
          });
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.loading = false;
          let errorMessage = 'Sign up failed. Please try again.';

          // Map Firebase error codes to user-friendly messages
          if (error.code === 'auth/email-already-in-use') {
            errorMessage =
              'This email is already registered. Please sign in instead.';
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Please provide a valid email address.';
          } else if (error.code === 'auth/weak-password') {
            errorMessage =
              'Your password is too weak. Please choose a stronger password.';
          }

          this.snackBar.open(errorMessage, 'Dismiss', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
        },
      });
  }

  navigateToSignIn(): void {
    this.router.navigate(['/auth/sign-in']);
  }
}
