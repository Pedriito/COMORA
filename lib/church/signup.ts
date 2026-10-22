/** Validation de l'inscription (mot de passe ou lien magique). Fonctions pures. */

export type SignupField = "firstName" | "lastName" | "email" | "password" | "confirm";

export type SignupInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirm: string;
};

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function readSignupForm(formData: FormData): SignupInput {
  const text = (key: string) => String(formData.get(key) ?? "");
  return {
    firstName: text("first_name").trim().replace(/\s+/g, " "),
    lastName: text("last_name").trim().replace(/\s+/g, " "),
    email: text("email").trim().toLowerCase(),
    password: text("password"),
    confirm: text("confirm"),
  };
}

/** Règle identique à celle de la base (minuscule, majuscule et chiffre, 10 caractères au moins). */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Le mot de passe doit faire au moins ${PASSWORD_MIN} caractères.`;
  if (password.length > PASSWORD_MAX) return `Le mot de passe ne peut pas dépasser ${PASSWORD_MAX} caractères.`;
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Le mot de passe doit contenir une minuscule, une majuscule et un chiffre.";
  }
  return null;
}

/** `withPassword` : faux pour le lien magique, qui n'a pas de mot de passe. */
export function validateSignup(input: SignupInput, withPassword: boolean): Partial<Record<SignupField, string>> {
  const errors: Partial<Record<SignupField, string>> = {};
  if (!input.firstName.trim()) errors.firstName = "Indiquez votre prénom.";
  else if (input.firstName.length > 80) errors.firstName = "Le prénom est trop long.";
  if (!input.lastName.trim()) errors.lastName = "Indiquez votre nom.";
  else if (input.lastName.length > 80) errors.lastName = "Le nom est trop long.";
  if (!EMAIL.test(input.email) || input.email.length > 254) errors.email = "Cette adresse e-mail ne semble pas valide.";
  if (withPassword) {
    const problem = passwordProblem(input.password);
    if (problem) errors.password = problem;
    else if (input.password !== input.confirm) errors.confirm = "Les deux mots de passe ne sont pas identiques.";
  }
  return errors;
}
