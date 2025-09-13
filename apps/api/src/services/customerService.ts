// apps/api/src/services/customerService.ts
import { db, stmts } from "../db/database";

export function isValidPhone(phone?: string) {
  if (!phone) return true;
  return /^[\d\s()+-]{6,}$/.test(phone);
}

export function getCustomerByEmail(email: string) {
  return stmts.getCustomerByEmail.get(email) as any;
}

export function insertCustomer(params: {
  email: string;
  password_hash: string;
  name: string | null;
  phone: string | null;
  companyName?: string | null;
  tradingName?: string | null;
  abn?: string | null;
  deliveryAddress?: string | null;
  billingAddress?: string | null;
}) {
  const info = stmts.insertCustomer.run({
    email: params.email,
    password_hash: params.password_hash,
    name: params.name,
    phone: params.phone,
  });
  return Number(info.lastInsertRowid);
}

export function getCustomerMinimalById(id: number) {
  return stmts.getCustomerById.get(id) as any;
}

export function getCustomerProfileById(id: number) {
  return stmts.getCustomerProfileById.get(id) as any;
}

export function updateCustomerProfile(id: number, fields: {
  name: string | null;
  companyName: string | null;
  tradingName: string | null;
  abn: string | null;
  deliveryAddress: string | null;
  billingAddress: string | null;
  phone: string | null;
}) {
  const row = db.prepare(`SELECT business_id FROM customers WHERE id = ?`).get(id) as { business_id?: number } | undefined;
  const bid = row?.business_id ?? null;
  if (bid) {
    db.prepare(
      `UPDATE business_customer SET
         abn = @abn,
         entity_name = @companyName,
         business_name = @tradingName,
         delivery_address = @deliveryAddress,
         billing_address = @billingAddress
       WHERE id = @bid`
    ).run({ bid, ...fields });
    db.prepare(`UPDATE customers SET name = @name, phone = @phone WHERE id = @id`).run({ id, name: fields.name, phone: fields.phone });
  } else {
    // If any business fields are provided, create a business and link this customer
    const hasBiz = (fields.companyName || fields.tradingName || fields.abn || fields.deliveryAddress || fields.billingAddress);
    if (hasBiz) {
      const info = db.prepare(
        `INSERT INTO business_customer (abn, entity_name, business_name, delivery_address, billing_address)
         VALUES (@abn, @companyName, @tradingName, @deliveryAddress, @billingAddress)`
      ).run(fields as any);
      const newBid = Number(info.lastInsertRowid);
      db.prepare(`UPDATE customers SET business_id = @bid WHERE id = @id`).run({ id, bid: newBid });
    }
    // Always update name/phone
    db.prepare(`UPDATE customers SET name = @name, phone = @phone WHERE id = @id`).run({ id, name: fields.name, phone: fields.phone });
  }
}

export function listAllCustomers(): Array<{
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  company_name: string | null;
  trading_name: string | null;
  abn: string | null;
  phone: string | null;
  is_admin: number | null;
  business_id?: number | null;
}> {
  return db
    .prepare(
      `SELECT
         c.id,
         c.email,
         c.name,
         c.created_at,
         b.entity_name   AS company_name,
         b.business_name AS trading_name,
         b.abn           AS abn,
         c.phone,
         c.is_admin,
         c.business_id
       FROM customers c
       LEFT JOIN business_customer b ON b.id = c.business_id
       ORDER BY c.created_at DESC`
    )
    .all() as any;
}

export function setCustomerPassword(id: number, password_hash: string) {
  db.prepare(`UPDATE customers SET password_hash = @password_hash WHERE id = @id`).run({ id, password_hash });
}

export function setCustomerAdminFlag(id: number, is_admin: boolean) {
  const val = is_admin ? 1 : 0;
  db.prepare(`UPDATE customers SET is_admin = @val WHERE id = @id`).run({ id, val });
}

export function findBusinessUniqueId(abn: string | null, entityName: string | null, businessName: string | null): number | null {
  const row = db
    .prepare(
      `SELECT id FROM business_customer
       WHERE COALESCE(LOWER(abn),'') = LOWER(COALESCE(?,''))
         AND LOWER(COALESCE(entity_name,''))   = LOWER(COALESCE(?,''))
         AND LOWER(COALESCE(business_name,'')) = LOWER(COALESCE(?,''))`
    )
    .get(abn ?? '', entityName ?? '', businessName ?? '') as { id?: number } | undefined;
  return (row?.id ?? null) as number | null;
}

export function insertBusinessReturnId(params: {
  abn: string | null;
  entity_name: string | null;
  business_name: string | null;
  delivery_address: string | null;
  billing_address: string | null;
}): number {
  const info = db.prepare(
    `INSERT INTO business_customer (abn, entity_name, business_name, delivery_address, billing_address)
     VALUES (@abn, @entity_name, @business_name, @delivery_address, @billing_address)`
  ).run(params);
  return Number(info.lastInsertRowid);
}

export function setCustomerBusinessId(customerId: number, businessId: number | null) {
  db.prepare(`UPDATE customers SET business_id = @businessId WHERE id = @customerId`).run({ customerId, businessId });
}
