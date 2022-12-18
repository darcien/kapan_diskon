import { z } from "https://deno.land/x/zod@v3.20.2/mod.ts";
import { logIfCi } from "./ci_utils.ts";
import { readJsonFile, writeJsonFile } from "./utils.ts";

enum NintendoSavePath {
  CurrentPrices = "./prices/nintendo_current_prices.json",
  HistoricalPrices = "./prices/nintendo_historical_prices.json",
}

enum CountryCode {
  US = "US",
}

const nameByNsuid = {
  "70010000000707": "Xenoblade Chronicles™ 2",
  "70070000000661":
    "Xenoblade Chronicles™ 2 and Xenoblade Chronicles™ 2 Expansion Pass Bundle",
  "70010000001620": "Luigi’s Mansion™ 3",
};

const priceApiSchema = z.object({
  prices: z.array(
    z
      .object({
        title_id: z.number().transform((arg) => String(arg)),
        regular_price: z.object({
          currency: z.string(),
          raw_value: z.string().transform((arg) => parseFloat(arg)),
        }),
      })
      .transform((arg) => ({
        nsuid: arg.title_id,
        price: arg.regular_price.raw_value,
        priceCurrency: arg.regular_price.currency,
      }))
  ),
});

type PricesRes = z.infer<typeof priceApiSchema>["prices"];

type CurrentPrice = {
  name: string;
  nsuid: string;
  price: number;
  priceCurrency: string;
  lowestPrice: number;
  lowestPriceAt: string;
  country: string;
};
type NintendoCurrentPricesData = Array<CurrentPrice>;

type NintendoHistoricalPricesData = {
  [nsuid: string]: Array<{
    price: number;
    priceCurrency: string;
    country: string;
    retrievedAt: string;
  }>;
};

function mergeCurrentPrices(
  old: NintendoCurrentPricesData,
  newPrices: PricesRes
): NintendoCurrentPricesData {
  const newCurrentPrices = new Map(
    old.map((current) => [current.nsuid, current])
  );
  for (const newPrice of newPrices) {
    const { nsuid, price, priceCurrency } = newPrice;
    const oldPrice = newCurrentPrices.get(nsuid);

    const lowestPrice =
      oldPrice?.lowestPrice != null
        ? Math.min(oldPrice?.lowestPrice, price)
        : price;

    const isLowestPriceUpdated = oldPrice?.lowestPrice != lowestPrice;

    const currentPrice: CurrentPrice = {
      ...oldPrice,
      country: CountryCode.US,
      name: nameByNsuid[nsuid as keyof typeof nameByNsuid] ?? "",
      nsuid,
      price,
      priceCurrency,
      lowestPrice,
      lowestPriceAt: isLowestPriceUpdated
        ? new Date().toISOString()
        : oldPrice.lowestPriceAt,
    };

    newCurrentPrices.set(nsuid, currentPrice);
  }

  return [...newCurrentPrices.values()];
}

function mergeHistoricalPrices(
  oldHistorical: NintendoHistoricalPricesData,
  newPrices: PricesRes
): NintendoHistoricalPricesData {
  const newHistoricalPrices = { ...oldHistorical };
  console.log({
    oldHistorical,
    newHistoricalPrices,
  });

  const retrievedAt = new Date().toISOString();
  for (const newPrice of newPrices) {
    const { nsuid, price, priceCurrency } = newPrice;
    const oldHistoricalPrice = oldHistorical[nsuid] || [];

    console.log({ oldHistoricalPrice });

    newHistoricalPrices[nsuid] = [
      ...oldHistoricalPrice,
      {
        price,
        priceCurrency,
        country: CountryCode.US,
        retrievedAt,
      },
    ];
  }

  console.log({ newHistoricalPrices });

  return newHistoricalPrices;
}

const nsuids = Object.keys(nameByNsuid);
const url = new URL("https://api.ec.nintendo.com/v1/price");
url.search = new URLSearchParams({
  country: CountryCode.US,
  lang: "en",
  ids: nsuids.join(","),
}).toString();

try {
  const res = await fetch(url);
  const resJson = await res.json();
  logIfCi({ resJson });
  const priceApiRes = priceApiSchema.parse(resJson);
  logIfCi({ priceApiRes });

  const oldCurrentPrices = await readJsonFile(NintendoSavePath.CurrentPrices);
  const newCurrentPrices = mergeCurrentPrices(
    oldCurrentPrices,
    priceApiRes.prices
  );
  logIfCi({ newCurrentPrices });
  await writeJsonFile(NintendoSavePath.CurrentPrices, newCurrentPrices);

  const oldHistoricalPrices = await readJsonFile(
    NintendoSavePath.HistoricalPrices
  );
  const newHistoricalPrices = mergeHistoricalPrices(
    oldHistoricalPrices,
    priceApiRes.prices
  );
  logIfCi({ newHistoricalPrices });
  await writeJsonFile(NintendoSavePath.HistoricalPrices, newHistoricalPrices);
} catch (error) {
  console.log(error);
}
