// List objects under an R2 prefix via the S3 ListObjectsV2 API (SigV4-signed).
// Zero-dependency: uses Node's built-in crypto + fetch. Needs env:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
// Returns [{ key, size }] for every object under the prefix (handles pagination).

import crypto from "node:crypto";

const REGION = "auto";
const SERVICE = "s3";

function hmac(key, str) { return crypto.createHmac("sha256", key).update(str).digest(); }
function sha256hex(str) { return crypto.createHash("sha256").update(str).digest("hex"); }

function signingKey(secret, date, region, service) {
  const kDate = hmac("AWS4" + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/**
 * One signed ListObjectsV2 request. Returns { keys:[{key,size}], nextToken }.
 */
async function listPage({ accountId, accessKeyId, secretAccessKey, bucket }, prefix, token) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const params = new URLSearchParams({ "list-type": "2", prefix });
  if (token) params.set("continuation-token", token);
  // canonical query string must be sorted
  const canonicalQuery = [...params.entries()].sort().map(([k, v]) =>
    `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

  const canonicalUri = `/${bucket}`;
  const payloadHash = sha256hex("");
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["GET", canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const sig = hmac(signingKey(secretAccessKey, dateStamp, REGION, SERVICE), toSign).toString("hex");
  const auth = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;

  const url = `https://${host}${canonicalUri}?${canonicalQuery}`;
  const res = await fetch(url, {
    headers: { host, "x-amz-date": amzDate, "x-amz-content-sha256": payloadHash, authorization: auth },
  });
  if (!res.ok) throw new Error(`R2 list failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const xml = await res.text();

  const keys = [];
  const re = /<Contents>(.*?)<\/Contents>/gs;
  let m;
  while ((m = re.exec(xml))) {
    const key = (m[1].match(/<Key>(.*?)<\/Key>/s) || [])[1];
    const size = parseInt((m[1].match(/<Size>(\d+)<\/Size>/s) || [])[1] || "0", 10);
    if (key) keys.push({ key: decodeXml(key), size });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const nextToken = truncated ? (xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/s) || [])[1] : null;
  return { keys, nextToken };
}

function decodeXml(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

/** List every object under a prefix (paginated). */
export async function listPrefix(creds, prefix) {
  const out = [];
  let token = null;
  do {
    const { keys, nextToken } = await listPage(creds, prefix, token);
    out.push(...keys);
    token = nextToken;
  } while (token);
  return out;
}

export function credsFromEnv() {
  const c = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET || "hyepar-audio",
  };
  const missing = ["accountId", "accessKeyId", "secretAccessKey"].filter((k) => !c[k]);
  return { creds: c, missing };
}
