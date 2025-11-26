import bcrypt from 'bcrypt';
import { settings } from '../config/settings.js';

const SALT_ROUNDS = 12;

export const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(plainPassword, salt);
};

export const verifyPassword = (plainPassword, hash) => bcrypt.compare(plainPassword, hash);

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
