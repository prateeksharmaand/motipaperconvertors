import type { Knex } from "knex";

const JOB_TYPES = [
  "Business Card",
  "Wedding Card",
  "Invitation Card",
  "Envelope",
  "Letterhead",
  "Visiting Card",
  "Brochure",
  "Pamphlet",
  "Flyer",
  "Poster",
  "Banner",
  "Flex",
  "Sticker",
  "Label",
  "Diary",
  "Calendar",
  "Bill Book",
  "Receipt Book",
  "Notepad",
  "Folder",
  "Certificate",
  "ID Card",
  "Menu Card",
  "Tag",
  "Carry Bag",
  "Box",
  "Packaging",
  "Rubber Stamp",
  "Cheque Book",
  "Voucher",
];

const PRINT_COLORS = [
  "Black & White",
  "1 Color",
  "2 Color",
  "3 Color",
  "4 Color",
  "Multicolor",
  "CMYK",
  "Pantone",
  "Gold Foil",
  "Silver Foil",
];

export async function seed(knex: Knex): Promise<void> {
  // Get all tenants
  const tenants = await knex("tenants").select("id");
  if (!tenants.length) return;

  for (const tenant of tenants) {
    const existingJobTypes = await knex("tenant_settings")
      .where({ tenant_id: tenant.id, key: "job_type" })
      .count("id as count")
      .first();

    if (Number(existingJobTypes?.count) === 0) {
      await knex("tenant_settings").insert(
        JOB_TYPES.map((name) => ({
          id: knex.raw("gen_random_uuid()"),
          tenant_id: tenant.id,
          key: "job_type",
          value: name,
        }))
      );
    }

    const existingColors = await knex("tenant_settings")
      .where({ tenant_id: tenant.id, key: "print_color" })
      .count("id as count")
      .first();

    if (Number(existingColors?.count) === 0) {
      await knex("tenant_settings").insert(
        PRINT_COLORS.map((name) => ({
          id: knex.raw("gen_random_uuid()"),
          tenant_id: tenant.id,
          key: "print_color",
          value: name,
        }))
      );
    }
  }
}
