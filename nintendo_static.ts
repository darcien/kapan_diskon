import { cheerio } from "https://deno.land/x/cheerio@1.0.7/mod.ts";
import { deepMerge } from "https://deno.land/std@0.167.0/collections/deep_merge.ts";
import { assertInstanceOf } from "https://deno.land/std@0.167.0/testing/asserts.ts";
import { logIfCi } from "./ci_utils.ts";

const url =
  "https://www.nintendo.com/store/products/xenoblade-chronicles-2-switch/";

const savePath = "./prices/nintendo.json";

try {
  const res = await fetch(url);
  const html = await res.text();

  const $ = cheerio.load(html);

  const productText = $(
    "script[id='__NEXT_DATA__'][type='application/json']"
  ).text();
  logIfCi({ productText });

  const productProps = JSON.parse(productText);
  logIfCi({ productProps });

  const variants = productProps?.props?.pageProps?.configurable?.variants;
  logIfCi({ variants });

  assertInstanceOf(variants, Array);

  const productVariants = variants as Array<Record<string, unknown>>;

  const now = new Date().toISOString();
  const productPrices = productVariants.map((variant) => {
    // TODO: need better parser here
    // deno-lint-ignore no-explicit-any
    const product = variant?.product as Record<string, any>;
    return {
      name: String(product?.name ?? ""),
      nsuid: String(product?.nsuid ?? ""),
      sku: String(product?.sku ?? ""),
      price: Number(product?.prices?.minimum?.finalPrice),
      // TODO: should get the currency from the page
      priceCurrency: "USD",
      retrievedAt: now,
    };
  });
  logIfCi({ productPrices });

  const oldPricesText = await Deno.readTextFile(savePath);
  const oldPrices = JSON.parse(oldPricesText);

  const newPrices = {
    lastCheckedAt: now,
    productPrices,
  };

  const merged = deepMerge(oldPrices, newPrices, { arrays: "merge" });

  await Deno.writeTextFile(savePath, JSON.stringify(merged, null, 2));
} catch (error) {
  console.log(error);
}
