const baseUrl = process.env.CRM_PUBLIC_URL || process.env.NEXT_PUBLIC_CRM_URL;
const secret = process.env.CRM_NOTIFICATIONS_DISPATCH_SECRET;

if (!baseUrl || !secret) {
  console.error("Defina CRM_PUBLIC_URL e CRM_NOTIFICATIONS_DISPATCH_SECRET.");
  process.exit(1);
}

const url = new URL("/api/crm/notifications/dispatch", baseUrl);
const response = await fetch(url, {
  method: "POST",
  headers: {
    authorization: `Bearer ${secret}`,
  },
});
const text = await response.text();

if (!response.ok) {
  console.error(text);
  process.exit(1);
}

console.log(text);
