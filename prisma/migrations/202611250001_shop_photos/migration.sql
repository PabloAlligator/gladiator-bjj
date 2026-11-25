ALTER TABLE "ShopProduct" ADD COLUMN "photos" TEXT NOT NULL DEFAULT '[]';
UPDATE "ShopProduct" SET "photos" = json_array("image") WHERE "image" IS NOT NULL AND "image" <> '';
