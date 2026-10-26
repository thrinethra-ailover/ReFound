export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}

export interface RegisterFormValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export function validateRegisterForm(values: RegisterFormValues): ValidationResult {
  const errors: Record<string, string> = {};

  if (!values.fullName.trim()) {
    errors.fullName = 'Enter your full name.';
  }
  if (!values.email.trim()) {
    errors.email = 'Enter your email address.';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Enter a valid email address.';
  }
  const passwordError = validatePassword(values.password);
  if (passwordError) {
    errors.password = passwordError;
  }
  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export interface LoginFormValues {
  email: string;
  password: string;
}

export function validateLoginForm(values: LoginFormValues): ValidationResult {
  const errors: Record<string, string> = {};
  if (!values.email.trim()) errors.email = 'Enter your email address.';
  else if (!isValidEmail(values.email)) errors.email = 'Enter a valid email address.';
  if (!values.password) errors.password = 'Enter your password.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export interface ReportFormValues {
  reportType: 'LOST' | 'FOUND';
  title: string;
  description: string;
  category: string;
  color: string;
  itemDatetime: string;
  locationName: string;
}

export function validateReportForm(values: ReportFormValues): ValidationResult {
  const errors: Record<string, string> = {};

  if (!values.title.trim()) {
    errors.title = 'Give the item a short title.';
  } else if (values.title.trim().length > 100) {
    errors.title = 'Title must be under 100 characters.';
  }
  if (!values.category) {
    errors.category = 'Choose a category.';
  }
  if (!values.itemDatetime) {
    errors.itemDatetime = `Enter when the item was ${values.reportType === 'LOST' ? 'lost' : 'found'}.`;
  } else if (new Date(values.itemDatetime).getTime() > Date.now() + 5 * 60 * 1000) {
    errors.itemDatetime = 'Date/time cannot be in the future.';
  }
  if (!values.locationName.trim()) {
    errors.locationName = 'Enter or select a location.';
  }
  if (values.description.length > 1000) {
    errors.description = 'Description must be under 1000 characters.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
