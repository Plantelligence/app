import nodemailer from 'nodemailer';
import { settings } from '../config/settings.js';

let transporter;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!settings.smtp.user || !settings.smtp.password || !settings.smtp.from) {
    throw new Error('SMTP credentials are not configured. Set SMTP_USER, SMTP_PASSWORD, and SMTP_FROM.');
  }

  transporter = nodemailer.createTransport({
    host: settings.smtp.host,
    port: settings.smtp.port,
    secure: settings.smtp.secure,
    auth: {
      user: settings.smtp.user,
      pass: settings.smtp.password
    }
  });

  return transporter;
};

export const sendMfaCodeEmail = async ({ to, code, expiresAt }) => {
  const mailer = getTransporter();

  const subject = 'Plantelligence - Código de autenticação multifator';
  const text = `Olá!

Seu código de autenticação multifator é ${code}.
Ele expira em ${new Date(expiresAt).toLocaleString()}.

Se você não solicitou este código, entre em contato imediatamente com o suporte de segurança.`;
  const html = `
    <p>Olá,</p>
    <p>Seu código de autenticação multifator é:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
    <p>Ele expira em <strong>${new Date(expiresAt).toLocaleString()}</strong>.</p>
    <p>Se você não solicitou este código, entre em contato com o suporte de segurança imediatamente.</p>
  `;

  await mailer.sendMail({
    from: settings.smtp.from,
    to,
    subject,
    text,
    html
  });
};

export const sendGreenhouseAlertEmail = async ({
  recipients,
  greenhouseName,
  profile,
  metrics,
  metricsEvaluation,
  alerts
}) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return;
  }

  const mailer = getTransporter();

  const subject = `Plantelligence - Alerta crítico na estufa ${greenhouseName}`;
  const listItems = alerts
    .map((alert) => `<li>${alert}</li>`)
    .join('');
  const plainAlerts = alerts.join('\n');

  const resolveMetricValue = (rawValue, evaluationEntry) => {
    const normalizedRaw = typeof rawValue === 'number' && Number.isFinite(rawValue)
      ? rawValue
      : Number.isFinite(Number.parseFloat(rawValue))
        ? Number.parseFloat(rawValue)
        : null;
    const evaluationValue = typeof evaluationEntry?.value === 'number' && Number.isFinite(evaluationEntry.value)
      ? evaluationEntry.value
      : null;
    const resolved = normalizedRaw ?? evaluationValue;

    if (resolved === null) {
      return 'n/d';
    }

    const fixed = resolved.toFixed(1);
    const numericFixed = Number.parseFloat(fixed);
    return Number.isInteger(numericFixed) ? String(numericFixed) : fixed;
  };

  const evaluatedMetrics = metricsEvaluation ?? {};
  const temperatureValue = resolveMetricValue(metrics?.temperature, evaluatedMetrics.temperature);
  const humidityValue = resolveMetricValue(metrics?.humidity, evaluatedMetrics.humidity);
  const soilMoistureValue = resolveMetricValue(metrics?.soilMoisture, evaluatedMetrics.soilMoisture);

  const text = `Equipe Plantelligence,\n\nDetectamos desvios nos parâmetros da estufa "${greenhouseName}" configurada para ${profile.name}.\n\nResumo dos alertas:\n${plainAlerts}\n\nLeituras atuais:\n- Temperatura: ${temperatureValue}°C\n- Umidade relativa: ${humidityValue}%\n- Umidade do substrato: ${soilMoistureValue}%\n\nRecomendamos verificar o painel para ajustar a automação.\n`;

  const html = `
    <p>Equipe Plantelligence,</p>
    <p>Detectamos desvios nos parâmetros da estufa <strong>${greenhouseName}</strong> configurada para <strong>${profile.name}</strong>.</p>
    <p>Resumo dos alertas:</p>
    <ul>
      ${listItems}
    </ul>
    <p>Leituras atuais:</p>
    <ul>
      <li>Temperatura: <strong>${temperatureValue}°C</strong></li>
      <li>Umidade relativa: <strong>${humidityValue}%</strong></li>
      <li>Umidade do substrato: <strong>${soilMoistureValue}%</strong></li>
    </ul>
    <p>Recomendamos verificar o painel Plantelligence para ajustar a automação.</p>
  `;

  await mailer.sendMail({
    from: settings.smtp.from,
    to: recipients,
    subject,
    text,
    html
  });
};
