/**
 * Seeds demo data for walking the 8 test scenarios (docs/TEST-SCENARIOS.md).
 *   npm run seed-demo
 * Needs the same env as the app + the OMS_* tabs to exist (run ensure-sheets first).
 * Idempotent-ish: skips a product / customer / user whose key already exists.
 */
import { readSheet, appendRow, nextId } from '../lib/sheets/rows';
import { OMS_SHEETS, ID_PREFIX } from '../lib/oms/constants';
import { hashPassword } from '../lib/auth/hash';

async function seedStaff() {
  const { rows } = await readSheet(OMS_SHEETS.STAFF);
  const have = new Set(rows.map((r) => String(r[3]).trim().toLowerCase()));
  const people: Array<[string, string, string]> = [
    ['Meena Manager', 'manager', 'MANAGER'],
    ['Sunil Sales', 'sales', 'SALES'],
    ['Wasim Warehouse', 'warehouse', 'WAREHOUSE'],
    ['Deepa Dispatch', 'dispatch', 'DISPATCH'],
  ];
  for (const [name, username, role] of people) {
    if (have.has(username)) { console.log(`skip staff ${username}`); continue; }
    const { rows: fresh } = await readSheet(OMS_SHEETS.STAFF);
    const id = nextId(ID_PREFIX.STAFF, fresh, 0);
    await appendRow(OMS_SHEETS.STAFF, [id, name, `${username}@setmiindia.org`, username, hashPassword('Demo@1234'), role, 'Active', new Date(), '']);
    console.log(`+ staff ${username} (${role}) — password Demo@1234`);
  }
}

async function seedCustomers() {
  const { rows } = await readSheet(OMS_SHEETS.CUSTOMERS);
  const have = new Set(rows.map((r) => String(r[6] || r[5]).trim().toLowerCase()));
  const custs: Array<[string, string, string]> = [
    ['ABC Traders', 'Anil Kumar', 'abc@example.com'],
    ['Delhi Electronics', 'Ravi Sharma', 'delhi@example.com'],
  ];
  for (const [company, contact, email] of custs) {
    if (have.has(email)) { console.log(`skip customer ${email}`); continue; }
    const { rows: fresh } = await readSheet(OMS_SHEETS.CUSTOMERS);
    const id = nextId(ID_PREFIX.CUSTOMER, fresh, 0);
    await appendRow(OMS_SHEETS.CUSTOMERS, [
      id, company, contact, '9876500000', '9876500000', email, email.toLowerCase(),
      hashPassword('Demo@1234'), '', 'Active', new Date(), 'seed', '',
    ]);
    console.log(`+ customer ${email} — password Demo@1234`);
  }
}

async function seedProducts() {
  const { rows } = await readSheet(OMS_SHEETS.PRODUCTS);
  const have = new Set(rows.map((r) => String(r[1]).trim().toUpperCase()).filter(Boolean));
  // grab a couple of real PFMS item ids to map onto, if PFMS_Items exists
  let pfmsIds: string[] = [];
  try {
    const { rows: it } = await readSheet('PFMS_Items');
    pfmsIds = it.filter((r) => r[0] && String(r[5]).trim() !== 'Inactive').map((r) => String(r[0]).trim()).slice(0, 3);
  } catch { /* no PFMS */ }

  const prods: Array<{ sku: string; name: string; cat: string; unit: string; pfms: string }> = [
    { sku: 'CON-3PIN', name: '3 Pin Connector', cat: 'Connectors', unit: 'Pcs', pfms: pfmsIds[0] || '' },
    { sku: 'CON-5PIN', name: '5 Pin Connector', cat: 'Connectors', unit: 'Pcs', pfms: pfmsIds[1] || '' },
    { sku: 'SOC-WP', name: 'Waterproof Socket', cat: 'Sockets & Plugs', unit: 'Pcs', pfms: pfmsIds[2] || '' },
    { sku: 'CBL-HDMI', name: 'HDMI Cable 1.5m', cat: 'Cables', unit: 'Pcs', pfms: '' }, // deliberately unmapped
  ];
  for (const p of prods) {
    if (have.has(p.sku)) { console.log(`skip product ${p.sku}`); continue; }
    const { rows: fresh } = await readSheet(OMS_SHEETS.PRODUCTS);
    const id = nextId(ID_PREFIX.PRODUCT, fresh, 0);
    const now = new Date();
    await appendRow(OMS_SHEETS.PRODUCTS, [
      id, p.sku, p.name, p.cat, '', `${p.name} — demo seed`, '', p.unit, '', '', p.pfms, 'Active', now, now,
    ]);
    console.log(`+ product ${p.sku}${p.pfms ? ` → PFMS ${p.pfms}` : ' (unmapped)'}`);
  }
}

(async () => {
  await seedStaff();
  await seedCustomers();
  await seedProducts();
  console.log('\nDone. Staff: manager/sales/warehouse/dispatch · Customers: abc@example.com / delhi@example.com · all passwords Demo@1234');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
