import bcrypt from 'bcrypt';
import { settings } from '../config/settings.js';

const SALT_ROUNDS = 12;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_REQUIREMENTS_MESSAGE =
  'A senha precisa ter no mínimo 8 caracteres, incluindo letra maiúscula, letra minúscula, número e caractere especial.';

export const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(plainPassword, salt);
};

export const verifyPassword = (plainPassword, hash) => bcrypt.compare(plainPassword, hash);

export const validatePasswordComplexity = (plainPassword) =>
  PASSWORD_COMPLEXITY_REGEX.test(plainPassword ?? '');

export const passwordRequirementsMessage = PASSWORD_REQUIREMENTS_MESSAGE;

export const calculatePasswordExpiry = () => {
  const expires = new Date();
  expires.setDate(expires.getDate() + settings.passwordExpiryDays);
  return expires.toISOString();
};

export const isPasswordExpired = (passwordExpiresAt) => {
  if (!passwordExpiresAt) {
    return false;
  }
  return new Date(passwordExpiresAt).getTime() <= Date.now();
};
