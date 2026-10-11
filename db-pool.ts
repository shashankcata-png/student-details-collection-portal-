import pg from 'pg';
import { rootCertificates } from 'node:tls';

// Public CA distributed by Supabase Studio (valid through April 2031).
// https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
export const SUPABASE_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

export function tpoPoolConfig(connectionString: string): pg.PoolConfig {
  const url = new URL(connectionString);
  const supabase = url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.com');
  if (supabase) {
    // pg's URL SSL options replace explicit CA configuration.
    // Enforce certificate AND hostname verification for Supabase.
    for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      url.searchParams.delete(key);
    }
  }
  return {
    connectionString: supabase ? url.toString() : connectionString,
    ssl: supabase ? { rejectUnauthorized: true, ca: [...rootCertificates, SUPABASE_CA] } : undefined,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  };
}

// Global cached pool to safely reuse connections across serverless freezes/thaws
declare global {
  // eslint-disable-next-line no-var
  var __portalSharedPgPool: pg.Pool | undefined;
}

export function getSharedPool(connectionString?: string): pg.Pool {
  const conn = (connectionString || process.env.DATABASE_URL || '').trim();
  if (!conn) throw new Error('Database connection string is required.');

  if (!globalThis.__portalSharedPgPool) {
    const config = tpoPoolConfig(conn);
    const pool = new pg.Pool(config);
    // Handle idle connection errors to prevent unhandled exceptions and process crashes
    pool.on('error', (err) => {
      console.error('PostgreSQL shared pool background error (connection will be replaced):', err?.message || err);
    });
    globalThis.__portalSharedPgPool = pool;
  }
  return globalThis.__portalSharedPgPool;
}
